/**
 * Elasticsearch Client and Indexing Service
 */

const { Client } = require('@elastic/elasticsearch');
const { parseKey } = require('../parser/utils/keyGenerator');

const ES_HOST = process.env.ES_HOST || 'http://localhost:9200';
const INDEX_NAME = 'healthcare_plans';

// Toggle between minimal and full object storage
// MINIMAL: Only stores objectId, objectType, _org, and direct fields (copay, deductible, name)
// FULL: Stores complete object with all nested references
const ES_STORAGE_MODE = process.env.ES_STORAGE_MODE || 'MINIMAL'; // Options: 'MINIMAL' or 'FULL'

const esClient = new Client({
  node: ES_HOST,
  requestTimeout: 30000,
  maxRetries: 3
});

/**
 * Determine join name based on objectType AND parent context
 */
function getJoinName(objectType, parentKey) {
  const normalizedType = objectType.toLowerCase();
  
  if (!parentKey) {
    return normalizedType;
  }
  
  const { objectType: parentObjectType } = parseKey(parentKey);
  
  if (normalizedType === 'membercostshare') {
    if (parentObjectType === 'plan') {
      return 'planCostShares';
    }
    if (parentObjectType === 'planservice') {
      return 'planserviceCostShares';
    }
  }
  
  const mappings = {
    'plan': 'plan',
    'planservice': 'linkedPlanServices',
    'service': 'linkedService'
  };
  
  return mappings[normalizedType] || normalizedType;
}

/**
 * Prepare document for indexing based on storage mode
 */
function prepareDocument(data, objectType, objectId, joinName, parentKey) {
  // In MINIMAL mode, parent field should be simple objectId
  // In FULL mode, parent field should be full key (type:objectId)
  const parentValue = parentKey ? (
    ES_STORAGE_MODE === 'MINIMAL' ? parseKey(parentKey).objectId : parentKey
  ) : null;

  const baseDocument = {
    objectType,
    objectId,
    _org: data._org,
    plan_join: parentKey ? {
      name: joinName,
      parent: parentValue
    } : joinName
  };

  if (ES_STORAGE_MODE === 'MINIMAL') {
    // MINIMAL mode: Only store metadata + direct scalar fields
    // Don't store nested object references
    const minimalDoc = { ...baseDocument };

    // Add direct scalar fields (not nested objects)
    const directFields = ['planType', 'creationDate', 'deductible', 'copay', 'name'];
    directFields.forEach(field => {
      if (data[field] !== undefined && typeof data[field] !== 'object') {
        minimalDoc[field] = data[field];
      }
    });

    console.log('Elasticsearch: Using MINIMAL storage mode');
    return minimalDoc;

  } else {
    // FULL mode: Store complete object
    console.log('Elasticsearch: Using FULL storage mode');
    return {
      ...data,
      objectType,
      objectId,
      plan_join: baseDocument.plan_join
    };
  }
}

/**
 * Initialize Elasticsearch index with parent-child mappings
 */
async function initializeIndex() {
  try {
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

    if (indexExists) {
      console.log('Elasticsearch: Index already exists:', INDEX_NAME);
      return;
    }

    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            objectId: { type: 'keyword' },
            objectType: { type: 'keyword' },
            _org: { type: 'keyword' },
            planType: { type: 'keyword' },
            creationDate: {
              type: 'date',
              format: 'dd-MM-yyyy||strict_date_optional_time||epoch_millis'
            },
            deductible: { type: 'integer' },
            copay: { type: 'integer' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            plan_join: {
              type: 'join',
              relations: {
                plan: ['planCostShares', 'linkedPlanServices'],
                linkedPlanServices: ['linkedService', 'planserviceCostShares']
              }
            }
          }
        },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1
        }
      }
    });

    console.log('Elasticsearch: Index created successfully:', INDEX_NAME);
    console.log('Elasticsearch: Storage mode:', ES_STORAGE_MODE);
  } catch (error) {
    console.error('Error initializing Elasticsearch index:', error);
    throw error;
  }
}

async function indexDocument(key, data, metadata) {
  try {
    const { objectType, objectId, parentKey } = metadata;
    
    const joinName = getJoinName(objectType, parentKey);

    // Prepare document based on storage mode (MINIMAL or FULL)
    const document = prepareDocument(data, objectType, objectId, joinName, parentKey);

    // Determine document ID and routing based on storage mode
    let docId, routing;
    
    if (ES_STORAGE_MODE === 'MINIMAL') {
      // Use simple objectId (matches reference implementation)
      docId = objectId;
      routing = parentKey ? parseKey(parentKey).objectId : objectId;
    } else {
      // Use full key with type prefix (more robust)
      docId = key;
      routing = parentKey || key;
    }

    const result = await esClient.index({
      index: INDEX_NAME,
      id: docId,
      routing: routing,
      body: document,
      refresh: 'wait_for'
    });

    console.log('Elasticsearch: Indexed', joinName, 'document:', docId);
    return result;
  } catch (error) {
    console.error('Error indexing document to Elasticsearch:', error);
    throw error;
  }
}

async function deleteDocument(key, parentKey = null) {
  // Determine document ID based on storage mode
  let docId, routing;

  try {
    if (ES_STORAGE_MODE === 'MINIMAL') {
      const { objectId } = parseKey(key);
      docId = objectId;
      routing = parentKey ? parseKey(parentKey).objectId : objectId;
    } else {
      docId = key;
      routing = parentKey || key;
    }

    const result = await esClient.delete({
      index: INDEX_NAME,
      id: docId,
      routing: routing,
      refresh: 'wait_for'
    });

    console.log('Elasticsearch: Deleted document:', docId);
    return result;
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) {
      console.log('Elasticsearch: Document not found for deletion:', docId);
      return null;
    }
    console.error('Error deleting document from Elasticsearch:', error);
    throw error;
  }
}

async function updateDocument(key, data, metadata) {
  try {
    return await indexDocument(key, data, metadata);
  } catch (error) {
    console.error('Error updating document in Elasticsearch:', error);
    throw error;
  }
}

async function searchDocuments(query) {
  try {
    const result = await esClient.search({
      index: INDEX_NAME,
      body: query
    });

    return result.hits.hits;
  } catch (error) {
    console.error('Error searching in Elasticsearch:', error);
    throw error;
  }
}

async function getDocument(key, parentKey = null) {
  // Determine document ID based on storage mode
  let docId, routing;

  try {
    if (ES_STORAGE_MODE === 'MINIMAL') {
      const { objectId } = parseKey(key);
      docId = objectId;
      routing = parentKey ? parseKey(parentKey).objectId : objectId;
    } else {
      docId = key;
      routing = parentKey || key;
    }

    const result = await esClient.get({
      index: INDEX_NAME,
      id: docId,
      routing: routing
    });

    return result._source;
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) {
      return null;
    }
    console.error('Error getting document from Elasticsearch:', error);
    throw error;
  }
}

async function healthCheck() {
  try {
    const health = await esClient.cluster.health();
    console.log('Elasticsearch health:', health.status);
    return health.status !== 'red';
  } catch (error) {
    console.error('Elasticsearch health check failed:', error);
    return false;
  }
}

module.exports = {
  esClient,
  initializeIndex,
  indexDocument,
  deleteDocument,
  updateDocument,
  searchDocuments,
  getDocument,
  healthCheck,
  INDEX_NAME,
  ES_STORAGE_MODE
};
