const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');
const validateValidJson = require('../middleware/validate_valid_json');
const validateGoogleToken = require('../middleware/auth');

router.put('/:objectId', validateGoogleToken, validateValidJson, async (req, res) => {
    const objectId = req.params.objectId;

    if (!req.body.objectId || req.body.objectId !== objectId) {
        return res.status(400).send("Bad Request: objectId mismatch");
    }

    await connectRedis();

    try {
        const existingData = await client.get(objectId);

        if (!existingData) {
            await client.quit();
            return res.status(404).send("Not Found");
        }

        // Check If-Match header for conditional update
        const ifMatch = req.headers['if-match'];
        if (ifMatch) {
            const currentETag = etag(existingData);

            // Remove quotes if present in If-Match header
            const normalizedIfMatch = ifMatch.replace(/^"|"$/g, '');

            if (normalizedIfMatch !== currentETag) {
                await client.quit();
                return res.status(412).send("Precondition Failed: Resource has been modified");
            }
        }

        // Update the resource
        const newData = JSON.stringify(req.body);
        await client.set(objectId, newData);

        // Generate ETag from new data
        const newETag = etag(newData);
        res.set('ETag', newETag);
        await client.quit();

        return res.status(200).json(req.body);
    } catch (err) {
        await client.quit();
        return res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
