const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateChildrenKey, generateMetadataKey } = require('../utils/keyGenerator');
const { publishIndexDelete } = require('../../events/publisher');

async function cascadeDelete(key, keysToDelete = [], parentKeyMap = new Map()) {
    const exists = await client.exists(key);
    if (!exists) {
        return { keysToDelete, parentKeyMap };
    }

    // Get metadata to store parent relationship before deletion
    const metadataKey = generateMetadataKey(key);
    const metadataStr = await client.get(metadataKey);
    if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        if (metadata.parentKey) {
            parentKeyMap.set(key, metadata.parentKey);
        }
    }

    const childrenKey = generateChildrenKey(key);
    const children = await client.sMembers(childrenKey);

    for (const childKey of children) {
        await cascadeDelete(childKey, keysToDelete, parentKeyMap);
    }

    keysToDelete.push(key);
    keysToDelete.push(childrenKey);
    keysToDelete.push(metadataKey);

    return { keysToDelete, parentKeyMap };
}

router.delete('/:objectId', validateGoogleToken, async (req, res) => {
    const { objectId } = req.params;
    
    await connectRedis();
    
    try {
        const objectType = "plan";
        const key = generateKey(objectType, objectId);
        
        const data = await client.get(key);
        if (!data) {
            return res.status(404).send("Not Found");
        }
        
        const { keysToDelete, parentKeyMap } = await cascadeDelete(key);

        // Extract all object keys (not metadata or children keys) for Elasticsearch deletion
        // This ensures ALL descendants (children, grandchildren, etc.) are deleted from ES
        const objectKeys = keysToDelete.filter(k =>
            !k.endsWith(':children') && !k.endsWith(':metadata')
        );

        // Remove the root key from the list (it will be passed separately to publishIndexDelete)
        const childKeys = objectKeys.filter(k => k !== key);

        if (keysToDelete.length > 0) {
            const pipeline = client.multi();
            for (const keyToDelete of keysToDelete) {
                pipeline.del(keyToDelete);
            }
            await pipeline.exec();
        }

        // Publish to RabbitMQ for Elasticsearch deletion
        // childKeys now includes ALL descendants (children + grandchildren + ...)
        // parentKeyMap contains parent relationships for proper routing
        await publishIndexDelete(key, childKeys, parentKeyMap);
        
        
        return res.status(204).send();
        
    } catch (err) {
        console.error('Error deleting object:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
