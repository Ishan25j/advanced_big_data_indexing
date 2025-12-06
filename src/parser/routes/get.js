const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateMetadataKey } = require('../utils/keyGenerator');
const { recompose } = require('../utils/objectDecomposer');

/**
 * Recursively fetch an object and all its children from Redis
 */
async function fetchObjectWithChildren(key, objectMap = new Map()) {
    const data = await client.get(key);
    if (!data) {
        return null;
    }

    const parsedData = JSON.parse(data);
    
    if (parsedData.objectId) {
        objectMap.set(parsedData.objectId, parsedData);
    }

    const metadataKey = generateMetadataKey(key);
    const metadata = await client.get(metadataKey);
    
    if (metadata) {
        const meta = JSON.parse(metadata);
        
        if (meta.hasChildren) {
            const childrenKey = `${key}:children`;
            const children = await client.sMembers(childrenKey);
            
            for (const childKey of children) {
                await fetchObjectWithChildren(childKey, objectMap);
            }
        }
    }

    return { rootObject: parsedData, objectMap };
}

router.get('/:objectId', validateGoogleToken, async (req, res) => {
    const { objectId } = req.params;
    
    await connectRedis();
    
    try {
        // For /v1/plan routes, objectType is always "plan"
        const objectType = "plan";
        const key = generateKey(objectType, objectId);
        
        // Fetch object and all its children
        const result = await fetchObjectWithChildren(key);
        
        if (!result) {
            return res.status(404).send("Not Found");
        }

        // Recompose the full nested object
        const fullObject = recompose(result.rootObject, result.objectMap);
        
        // Generate ETag for the complete reconstructed object
        const etagValue = etag(JSON.stringify(fullObject));
        
        // Handle conditional GET (304 Not Modified)
        if (req.headers['if-none-match'] && String(req.headers['if-none-match']) === etagValue) {
            return res.status(304).end();
        }

        res.set('ETag', String(etagValue));
        return res.status(200).json(fullObject);
        
    } catch (err) {
        console.error('Error fetching object:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
