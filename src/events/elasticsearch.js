/**
 * Elasticsearch Client and Indexing Service
 */

const { Client } = require('@elastic/elasticsearch');

const ES_HOST = process.env.ES_HOST || 'http://localhost:9200';
const INDEX_NAME = 'healthcare_plans';

const esClient = new Client({
  node: ES_HOST,
  requestTimeout: 30000,
  maxRetries: 3
});

// Map objectType to Elasticsearch join field names
const OBJECT_TYPE_TO_JOIN_NAME = {
  'plan': 'plan',
  'membercostshare': 'planCostShares',
  'planservice': 'linkedPlanServices',
  'service': 'linkedService',
  'planservicecostshare': 'planserviceCostShares'
};

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
  } catch (error) {
    console.error('Error initializing Elasticsearch index:', error);
    throw error;
  }
}

async function indexDocument(key, data, metadata) {
  try {
    const { objectType, objectId, parentKey } = metadata;
    
    // Map objectType to ES join field name
    const joinName = OBJECT_TYPE_TO_JOIN_NAME[objectType.toLowerCase()] || objectType;

    const document = {
      ...data,
      objectType,
      objectId,
      plan_join: parentKey ? {
        name: joinName,
        parent: parentKey
      } : joinName
    };

    const result = await esClient.index({
      index: INDEX_NAME,
      id: key,
      routing: parentKey || key,
      body: document,
      refresh: 'wait_for'
    });

    console.log('Elasticsearch: Indexed', joinName, 'document:', key);
    return result;
  } catch (error) {
    console.error('Error indexing document to Elasticsearch:', error);
    throw error;
  }
}

async function deleteDocument(key, parentKey = null) {
  try {
    const result = await esClient.delete({
      index: INDEX_NAME,
      id: key,
      routing: parentKey || key,
      refresh: 'wait_for'
    });

    console.log('Elasticsearch: Deleted document:', key);
    return result;
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) {
      console.log('Elasticsearch: Document not found for deletion:', key);
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
  try {
    const result = await esClient.get({
      index: INDEX_NAME,
      id: key,
      routing: parentKey || key
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
  INDEX_NAME
};
