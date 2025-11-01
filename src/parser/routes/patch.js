const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');
const validateValidJson = require('../middleware/validate_valid_json');
const validateGoogleToken = require('../middleware/auth');

function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                // Recursively merge nested objects
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                // Overwrite or add the property
                result[key] = source[key];
            }
        }
    }

    return result;
}

router.patch('/:objectId', validateGoogleToken, validateValidJson, async (req, res) => {
    const objectId = req.params.objectId;

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

        // Parse existing data and merge with patch
        const existingObject = JSON.parse(existingData);
        const mergedObject = deepMerge(existingObject, req.body);

        // Preserve the objectId to prevent it from being changed
        mergedObject.objectId = objectId;

        // Save the merged data
        const newData = JSON.stringify(mergedObject);
        await client.set(objectId, newData);

        // Generate ETag from new data
        const newETag = etag(newData);
        res.set('ETag', newETag);
        await client.quit();

        return res.status(200).json(mergedObject);
    } catch (err) {
        await client.quit();
        return res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
