const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');
const validateValidJson = require('../middleware/validate_valid_json');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateChildrenKey, generateMetadataKey } = require('../utils/keyGenerator');
const { decompose } = require('../utils/objectDecomposer');
const { publishIndexUpdate } = require('../../events/publisher');

async function collectKeysToDelete(key, keysToDelete = []) {
    const exists = await client.exists(key);
    if (!exists) {
        return keysToDelete;
    }

    const childrenKey = generateChildrenKey(key);
    const children = await client.sMembers(childrenKey);
    
    for (const childKey of children) {
        await collectKeysToDelete(childKey, keysToDelete);
    }

    keysToDelete.push(key);
    keysToDelete.push(childrenKey);
    keysToDelete.push(generateMetadataKey(key));

    return keysToDelete;
}

router.put('/:objectId', validateGoogleToken, validateValidJson, async (req, res) => {
    const { objectId } = req.params;

    if (!req.body.objectId || req.body.objectId !== objectId) {
        return res.status(400).send("Bad Request: objectId mismatch");
    }

    await connectRedis();

    try {
        const objectType = "plan";
        
        if (!req.body.objectType || req.body.objectType !== objectType) {
            return res.status(400).send("Bad Request: objectType must be 'plan'");
        }

        const key = generateKey(objectType, objectId);
        
        const existingData = await client.get(key);

        if (!existingData) {
            return res.status(404).send("Not Found");
        }

        const ifMatch = req.headers['if-match'];
        if (ifMatch) {
            const currentETag = etag(existingData);
            const normalizedIfMatch = ifMatch.replace(/^"|"$/g, '');

            if (normalizedIfMatch !== currentETag) {
                return res.status(412).send("Precondition Failed: Resource has been modified");
            }
        }

        const keysToDelete = await collectKeysToDelete(key);
        const decomposedObjects = decompose(req.body);

        const pipeline = client.multi();

        for (const keyToDelete of keysToDelete) {
            pipeline.del(keyToDelete);
        }

        for (const obj of decomposedObjects) {
            pipeline.set(obj.key, JSON.stringify(obj.value));

            if (obj.children && obj.children.length > 0) {
                const childrenKey = generateChildrenKey(obj.key);
                pipeline.sAdd(childrenKey, obj.children);
            }

            const metadataKey = generateMetadataKey(obj.key);
            const metadata = {
                objectType: obj.objectType,
                objectId: obj.objectId,
                parentKey: obj.parentKey,
                hasChildren: obj.children.length > 0
            };
            pipeline.set(metadataKey, JSON.stringify(metadata));
        }

        await pipeline.exec();

        // Publish to RabbitMQ for Elasticsearch update
        await publishIndexUpdate(decomposedObjects);

        const newETag = etag(JSON.stringify(req.body));
        res.set('ETag', newETag);

        return res.status(200).json({
            message: "Object updated successfully",
            objectId: req.body.objectId,
            objectType: req.body.objectType,
            key: key,
            decomposedCount: decomposedObjects.length,
            data: req.body
        });
        
    } catch (err) {
        console.error('Error updating object:', err);
        if (client.isOpen) {
        }
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
