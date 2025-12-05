/**
 * Key Generation Utility for Redis Storage and Elasticsearch Indexing
 *
 * Key Format: {objectType}:{objectId}
 * Examples:
 *   - plan:12xvxc345ssdsds-508
 *   - membercostshare:1234512xsfsdf
 *   - planservice:35xfsdfs3448ssf-505
 *   - service:1234512xsfsdf-507
 */

/**
 * Generate a Redis key for an object
 * @param {string} objectType - Type of the object (e.g., 'plan', 'service', 'membercostshare')
 * @param {string} objectId - Unique identifier for the object
 * @returns {string} Generated key in format objectType:objectId
 */
function generateKey(objectType, objectId) {
  if (!objectType || !objectId) {
    throw new Error('objectType and objectId are required for key generation');
  }

  // Normalize objectType to lowercase for consistency
  const normalizedType = objectType.toLowerCase();

  return `${normalizedType}:${objectId}`;
}

/**
 * Parse a Redis key to extract objectType and objectId
 * @param {string} key - Redis key in format objectType:objectId
 * @returns {{objectType: string, objectId: string}} Parsed components
 */
function parseKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid key provided');
  }

  const parts = key.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid key format. Expected 'objectType:objectId', got '${key}'`);
  }

  return {
    objectType: parts[0],
    objectId: parts[1]
  };
}

/**
 * Generate a parent-child relationship tracking key
 * Used to store the list of child object keys for a given parent
 * @param {string} parentKey - The parent object's key
 * @returns {string} Key for storing children references
 */
function generateChildrenKey(parentKey) {
  return `${parentKey}:children`;
}

/**
 * Check if a key represents a specific object type
 * @param {string} key - Redis key to check
 * @param {string} objectType - Object type to match
 * @returns {boolean} True if key matches the object type
 */
function isKeyOfType(key, objectType) {
  try {
    const parsed = parseKey(key);
    return parsed.objectType === objectType.toLowerCase();
  } catch (error) {
    return false;
  }
}

module.exports = {
  generateKey,
  parseKey,
  generateChildrenKey,
  isKeyOfType
};
