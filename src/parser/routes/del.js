const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const validateGoogleToken = require('../middleware/auth');
const { generateKey, generateChildrenKey, generateMetadataKey, parseKey } = require('../utils/keyGenerator');
const { publishIndexDelete } = require('../../events/publisher');

/**
 * Recursively collect all keys to delete (cascade delete)
 * Industry standard: Track parent relationships and verify all keys exist
 */
async function cascadeDelete(key, keysToDelete = [], parentKeyMap = new Map()) {
    // Check if key exists
    const exists = await client.exists(key);
    if (!exists) {
        console.warn(`Warning: Key does not exist: ${key}`);
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

    // Get children and recursively delete them
    const childrenKey = generateChildrenKey(key);
    const children = await client.sMembers(childrenKey);

    for (const childKey of children) {
        await cascadeDelete(childKey, keysToDelete, parentKeyMap);
    }

    // Add this key and its metadata/children keys to deletion list
    keysToDelete.push(key);
    keysToDelete.push(childrenKey);
    keysToDelete.push(metadataKey);

    return { keysToDelete, parentKeyMap };
}

/**
 * Get deletion summary by object type
 */
function getDeletionSummary(keysToDelete) {
    const objectKeys = keysToDelete.filter(k =>
        !k.endsWith(':children') && !k.endsWith(':metadata')
    );

    const summary = {};
    let totalObjects = 0;

    for (const key of objectKeys) {
        const { objectType } = parseKey(key);
        summary[objectType] = (summary[objectType] || 0) + 1;
        totalObjects++;
    }

    return { summary, totalObjects, totalKeys: keysToDelete.length };
}

router.delete('/:objectId', validateGoogleToken, async (req, res) => {
    const { objectId } = req.params;

    await connectRedis();

    try {
        const objectType = "plan";
        const key = generateKey(objectType, objectId);

        console.log(`DELETE request: ${key}`);

        // Step 1: Verify object exists
        const data = await client.get(key);
        if (!data) {
            console.log(`Object not found: ${key}`);
            return res.status(404).json({
                error: 'Not Found',
                message: `Object with ID '${objectId}' does not exist`
            });
        }

        // Step 2: Discover all keys to delete (cascade)
        const { keysToDelete, parentKeyMap } = await cascadeDelete(key);

        // Step 3: Get deletion summary
        const { summary, totalObjects, totalKeys } = getDeletionSummary(keysToDelete);

        console.log(`Cascade delete: ${totalObjects} objects, ${totalKeys} total keys`);
        console.log('Object types:', summary);

        // Step 4: Extract object keys for Elasticsearch deletion
        const objectKeys = keysToDelete.filter(k =>
            !k.endsWith(':children') && !k.endsWith(':metadata')
        );

        // Remove the root key from child list (sent separately to publishIndexDelete)
        const childKeys = objectKeys.filter(k => k !== key);

        // Step 5: Delete from Redis (atomic transaction)
        if (keysToDelete.length > 0) {
            const pipeline = client.multi();
            for (const keyToDelete of keysToDelete) {
                pipeline.del(keyToDelete);
            }
            await pipeline.exec();
            console.log(`Deleted ${keysToDelete.length} keys from Redis`);
        }

        // Step 6: Publish to RabbitMQ for Elasticsearch deletion
        await publishIndexDelete(key, childKeys, parentKeyMap);

        console.log(`Published delete operations to queue (root + ${childKeys.length} children)`);
        console.log(`DELETE completed: ${key}\n`);

        // Return 204 No Content (standard for successful DELETE)
        return res.status(204).send();

    } catch (err) {
        console.error('DELETE failed:', err.message);
        console.error('Stack:', err.stack);

        return res.status(500).json({
            error: 'Internal server error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
