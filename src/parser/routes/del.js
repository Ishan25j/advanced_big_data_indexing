const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateChildrenKey } = require('../utils/keyGenerator');
const { publishIndexDelete } = require('../../events/publisher');

async function cascadeDelete(key, keysToDelete = []) {
    const exists = await client.exists(key);
    if (!exists) {
        return keysToDelete;
    }

    const childrenKey = generateChildrenKey(key);
    const children = await client.sMembers(childrenKey);
    
    for (const childKey of children) {
        await cascadeDelete(childKey, keysToDelete);
    }

    keysToDelete.push(key);
    keysToDelete.push(childrenKey);
    keysToDelete.push(key + ':metadata');

    return keysToDelete;
}

router.delete('/:objectId', validateGoogleToken, async (req, res) => {
    const { objectId } = req.params;
    
    await connectRedis();
    
    try {
        const objectType = "plan";
        const key = generateKey(objectType, objectId);
        
        const data = await client.get(key);
        if (!data) {
            await client.quit();
            return res.status(404).send("Not Found");
        }
        
        const keysToDelete = await cascadeDelete(key);
        
        // Extract child keys for Elasticsearch deletion
        const childrenKey = generateChildrenKey(key);
        const childKeys = await client.sMembers(childrenKey);
        
        if (keysToDelete.length > 0) {
            const pipeline = client.multi();
            for (const keyToDelete of keysToDelete) {
                pipeline.del(keyToDelete);
            }
            await pipeline.exec();
        }
        
        // Publish to RabbitMQ for Elasticsearch deletion
        await publishIndexDelete(key, childKeys);
        
        await client.quit();
        
        return res.status(204).send();
        
    } catch (err) {
        console.error('Error deleting object:', err);
        if (client.isOpen) {
            await client.quit();
        }
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
