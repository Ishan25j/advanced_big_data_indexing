const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');
const validateValidJson = require('../middleware/validate_valid_json');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateChildrenKey } = require('../utils/keyGenerator');
const { decompose, recompose } = require('../utils/objectDecomposer');
const { publishIndexUpdate } = require('../../events/publisher');

function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }

    return result;
}

async function fetchObjectWithChildren(key, objectMap = new Map()) {
    const data = await client.get(key);
    if (!data) {
        return null;
    }

    const parsedData = JSON.parse(data);
    
    if (parsedData.objectId) {
        objectMap.set(parsedData.objectId, parsedData);
    }

    const metadataKey = key + ':metadata';
    const metadata = await client.get(metadataKey);
    
    if (metadata) {
        const meta = JSON.parse(metadata);
        
        if (meta.hasChildren) {
            const childrenKey = key + ':children';
            const children = await client.sMembers(childrenKey);
            
            for (const childKey of children) {
                await fetchObjectWithChildren(childKey, objectMap);
            }
        }
    }

    return { rootObject: parsedData, objectMap };
}

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
    keysToDelete.push(key + ':metadata');

    return keysToDelete;
}

router.patch('/:objectId', validateGoogleToken, validateValidJson, async (req, res) => {
    const { objectId } = req.params;

    await connectRedis();

    try {
        const objectType = "plan";
        const key = generateKey(objectType, objectId);
        
        const result = await fetchObjectWithChildren(key);

        if (!result) {
            await client.quit();
            return res.status(404).send("Not Found");
        }

        const existingObject = recompose(result.rootObject, result.objectMap);
        
        const ifMatch = req.headers['if-match'];
        if (ifMatch) {
            const currentETag = etag(JSON.stringify(existingObject));
            const normalizedIfMatch = ifMatch.replace(/^"|"$/g, '');

            if (normalizedIfMatch !== currentETag) {
                await client.quit();
                return res.status(412).send("Precondition Failed: Resource has been modified");
            }
        }

        const mergedObject = deepMerge(existingObject, req.body);

        mergedObject.objectId = objectId;
        mergedObject.objectType = objectType;

        const keysToDelete = await collectKeysToDelete(key);
        const decomposedObjects = decompose(mergedObject);

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

            const metadataKey = obj.key + ':metadata';
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
        // This satisfies the demo requirement: "PATCH working all the way to the index"
        await publishIndexUpdate(decomposedObjects);

        const newETag = etag(JSON.stringify(mergedObject));
        res.set('ETag', newETag);
        await client.quit();

        return res.status(200).json({
            message: "Object patched successfully",
            objectId: mergedObject.objectId,
            objectType: mergedObject.objectType,
            key: key,
            decomposedCount: decomposedObjects.length,
            data: mergedObject
        });
        
    } catch (err) {
        console.error('Error patching object:', err);
        if (client.isOpen) {
            await client.quit();
        }
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
