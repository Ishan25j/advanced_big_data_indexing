const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');
const validateValidJson = require('../middleware/validate_valid_json');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateChildrenKey, generateMetadataKey } = require('../utils/keyGenerator');
const { decompose, recompose } = require('../utils/objectDecomposer');
const { publishIndexUpdate, publishIndexDelete } = require('../../events/publisher');

function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (Array.isArray(source[key])) {
                // Smart array merging by objectId
                const targetArray = Array.isArray(result[key]) ? result[key] : [];
                const sourceArray = source[key];

                // Create a map of existing items by objectId
                const mergedMap = new Map();

                // Add all existing items to map
                targetArray.forEach(item => {
                    if (item && item.objectId) {
                        mergedMap.set(item.objectId, item);
                    }
                });

                // Merge or add items from source
                sourceArray.forEach(sourceItem => {
                    if (sourceItem && sourceItem.objectId) {
                        const existingItem = mergedMap.get(sourceItem.objectId);
                        if (existingItem) {
                            // Update existing item (deep merge)
                            mergedMap.set(sourceItem.objectId, deepMerge(existingItem, sourceItem));
                        } else {
                            // Add new item
                            mergedMap.set(sourceItem.objectId, sourceItem);
                        }
                    }
                });

                result[key] = Array.from(mergedMap.values());
            } else if (source[key] && typeof source[key] === 'object') {
                // Deep merge objects
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                // Replace primitives
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

    const metadataKey = generateMetadataKey(key);
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
    keysToDelete.push(generateMetadataKey(key));

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
            return res.status(404).send("Not Found");
        }

        const existingObject = recompose(result.rootObject, result.objectMap);
        
        const ifMatch = req.headers['if-match'];
        if (ifMatch) {
            const currentETag = etag(JSON.stringify(existingObject));
            const normalizedIfMatch = ifMatch.replace(/^"|"$/g, '');

            if (normalizedIfMatch !== currentETag) {
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

        // Publish DELETE operations for truly removed children to Elasticsearch
        if (keysToDeleteFromES.length > 0) {
            console.log(`PATCH: Deleting ${keysToDeleteFromES.length} removed children from Elasticsearch`);
            await publishIndexDelete(null, keysToDeleteFromES, parentKeyMap);
        }

        // Publish UPDATE operations for new data to Elasticsearch
        // This satisfies the demo requirement: "PATCH working all the way to the index"
        await publishIndexUpdate(decomposedObjects);

        const newETag = etag(JSON.stringify(mergedObject));
        res.set('ETag', newETag);

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
        }
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
