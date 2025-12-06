const express = require('express');
const etag = require('../utils/etag/etag');
const { client, connectRedis } = require('../utils/services/redis');
const { generateKey, generateChildrenKey, generateMetadataKey } = require('../utils/keyGenerator');
const { decompose } = require('../utils/objectDecomposer');
const { publishIndexCreate } = require('../../events/publisher');

const router = express.Router();
const validateValidJson = require('../middleware/validate_valid_json');
const validateGoogleToken = require('../middleware/auth');

router.post('/', validateGoogleToken, validateValidJson, async (req, res) => {
    if (!req.body.objectId || !req.body.objectType) {
        return res.status(400).send("Bad Request: objectId and objectType are required");
    }

    await connectRedis();

    try {
        const rootKey = generateKey(req.body.objectType, req.body.objectId);

        // Atomic check-and-set using SET NX (set if not exists)
        // This prevents race conditions where two concurrent requests
        // could both pass a GET check and create duplicate objects
        const claimResult = await client.set(rootKey, 'CLAIMED', {
            NX: true,  // Only set if key doesn't exist
            EX: 60     // Expire after 60 seconds (safety cleanup if process crashes)
        });

        if (!claimResult) {
            // Key already exists - another request won the race
            return res.status(409).send("Object already exists");
        }

        const decomposedObjects = decompose(req.body);

        const pipeline = client.multi();

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

        // Publish to RabbitMQ for Elasticsearch indexing
        await publishIndexCreate(decomposedObjects, req.body);

        const etagValue = etag(JSON.stringify(req.body));
        res.set('ETag', etagValue);

        return res.status(201).json({
            message: "Object created successfully",
            objectId: req.body.objectId,
            objectType: req.body.objectType,
            key: rootKey,
            decomposedCount: decomposedObjects.length,
            data: req.body
        });

    } catch (error) {
        console.error('Error creating object:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

module.exports = router;
