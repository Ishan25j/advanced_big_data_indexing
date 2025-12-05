/**
 * Object Decomposition Utility for Parent-Child Relationship Management
 *
 * This utility decomposes nested JSON objects into flat key-value pairs
 * while maintaining parent-child relationships for:
 * - Redis storage
 * - Elasticsearch parent-child indexing
 * - Cascaded operations (delete, update)
 */

const { generateKey, generateChildrenKey } = require('./keyGenerator');

/**
 * Decompose a nested object into individual objects with parent-child relationships
 *
 * @param {Object} data - The root object to decompose
 * @param {string|null} parentKey - The parent's Redis key (null for root)
 * @returns {Array} Array of objects with structure:
 *   {
 *     key: string,           // Redis key for this object
 *     value: Object,         // The object data
 *     parentKey: string|null // Parent's key (null for root)
 *     children: Array        // Array of child keys
 *   }
 */
function decompose(data, parentKey = null) {
  const results = [];
  const children = [];

  if (!data || typeof data !== 'object' || !data.objectId || !data.objectType) {
    throw new Error('Invalid object: must have objectId and objectType properties');
  }

  // Generate key for current object
  const currentKey = generateKey(data.objectType, data.objectId);

  // Create a shallow copy of the object for storage
  const objectToStore = { ...data };

  // Recursively process nested objects and arrays
  for (const [key, value] of Object.entries(data)) {
    if (key === 'objectId' || key === 'objectType' || key === '_org') {
      continue; // Skip metadata fields, keep them in objectToStore
    }

    if (isNestedObject(value)) {
      // Process nested object
      const nestedResults = decompose(value, currentKey);
      results.push(...nestedResults);

      // Track this child
      children.push(nestedResults[0].key);

      // Store reference to child in parent object
      objectToStore[key] = {
        objectId: value.objectId,
        objectType: value.objectType,
        _org: value._org || data._org
      };

    } else if (Array.isArray(value)) {
      // Process array of objects
      const processedArray = [];

      for (const item of value) {
        if (isNestedObject(item)) {
          const nestedResults = decompose(item, currentKey);
          results.push(...nestedResults);

          // Track this child
          children.push(nestedResults[0].key);

          // Store reference to child
          processedArray.push({
            objectId: item.objectId,
            objectType: item.objectType,
            _org: item._org || data._org
          });
        } else {
          // Primitive value in array, keep as is
          processedArray.push(item);
        }
      }

      objectToStore[key] = processedArray;
    }
    // For primitive values, they're already in objectToStore
  }

  // Add current object to results
  results.unshift({
    key: currentKey,
    value: objectToStore,
    parentKey: parentKey,
    children: children,
    objectType: data.objectType,
    objectId: data.objectId
  });

  return results;
}

/**
 * Check if a value is a nested object that should be decomposed
 * @param {*} value - Value to check
 * @returns {boolean} True if value is an object with objectId and objectType
 */
function isNestedObject(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.objectId &&
    value.objectType
  );
}

/**
 * Reconstruct a full nested object from decomposed parts
 *
 * @param {Object} rootObject - The root object data
 * @param {Map} objectMap - Map of objectId -> full object data
 * @returns {Object} Fully reconstructed nested object
 */
function recompose(rootObject, objectMap) {
  if (!rootObject || typeof rootObject !== 'object') {
    return rootObject;
  }

  const reconstructed = { ...rootObject };

  for (const [key, value] of Object.entries(rootObject)) {
    if (isNestedObject(value)) {
      // This is a reference to a nested object, fetch and reconstruct it
      const fullObject = objectMap.get(value.objectId);
      if (fullObject) {
        reconstructed[key] = recompose(fullObject, objectMap);
      }
    } else if (Array.isArray(value)) {
      // Process array
      reconstructed[key] = value.map(item => {
        if (isNestedObject(item)) {
          const fullObject = objectMap.get(item.objectId);
          return fullObject ? recompose(fullObject, objectMap) : item;
        }
        return item;
      });
    }
  }

  return reconstructed;
}

/**
 * Extract all object IDs from a nested structure (for cascaded operations)
 *
 * @param {Object} data - Root object
 * @returns {Array<string>} Array of all objectIds in the structure
 */
function extractAllObjectIds(data) {
  const objectIds = [];

  function traverse(obj) {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (obj.objectId) {
      objectIds.push(obj.objectId);
    }

    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        traverse(value);
      }
    }
  }

  traverse(data);
  return objectIds;
}

/**
 * Build parent-child relationship map for Elasticsearch
 *
 * @param {Array} decomposedObjects - Array from decompose()
 * @returns {Object} Map of objectId -> {parent: parentId, type: objectType}
 */
function buildParentChildMap(decomposedObjects) {
  const relationshipMap = {};

  for (const obj of decomposedObjects) {
    relationshipMap[obj.objectId] = {
      objectType: obj.objectType,
      parentKey: obj.parentKey,
      childKeys: obj.children
    };
  }

  return relationshipMap;
}

module.exports = {
  decompose,
  recompose,
  extractAllObjectIds,
  buildParentChildMap,
  isNestedObject
};
