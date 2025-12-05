/**
 * RabbitMQ Publisher
 *
 * Publishes indexing operations to RabbitMQ queue
 * for asynchronous processing by the consumer
 */

const { getChannel, EXCHANGE_NAME, ROUTING_KEY } = require('./rabbitmq');

/**
 * Operation types for Elasticsearch indexing
 */
const OPERATIONS = {
  INDEX: 'INDEX',      // Create or update document
  DELETE: 'DELETE',    // Delete document
  UPDATE: 'UPDATE'     // Partial update
};

/**
 * Publish an indexing operation to RabbitMQ
 */
async function publishIndexOperation(operation, data, metadata = {}) {
  try {
    const channel = await getChannel();

    const message = {
      operation,
      data,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        retryCount: 0
      }
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));

    const published = channel.publish(
      EXCHANGE_NAME,
      ROUTING_KEY,
      messageBuffer,
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now()
      }
    );

    if (published) {
      console.log('Published operation:', operation, 'for key:', metadata.key || 'unknown');
      return true;
    } else {
      console.warn('Message not published - channel buffer full');
      return false;
    }

  } catch (error) {
    console.error('Error publishing to RabbitMQ:', error);
    throw error;
  }
}

/**
 * Publish CREATE/UPDATE operation
 */
async function publishIndexCreate(decomposedObjects, fullObject) {
  try {
    for (const obj of decomposedObjects) {
      await publishIndexOperation(OPERATIONS.INDEX, obj.value, {
        key: obj.key,
        objectType: obj.objectType,
        objectId: obj.objectId,
        parentKey: obj.parentKey,
        hasChildren: obj.children && obj.children.length > 0,
        childKeys: obj.children || []
      });
    }
    console.log('Published index operations:', decomposedObjects.length);
  } catch (error) {
    console.error('Error publishing index create:', error);
    throw error;
  }
}

/**
 * Publish DELETE operation
 */
async function publishIndexDelete(key, childKeys = []) {
  try {
    for (const childKey of childKeys) {
      await publishIndexOperation(OPERATIONS.DELETE, null, {
        key: childKey
      });
    }

    await publishIndexOperation(OPERATIONS.DELETE, null, {
      key,
      childKeys
    });

    console.log('Published delete operation for:', key, 'with children:', childKeys.length);
  } catch (error) {
    console.error('Error publishing index delete:', error);
    throw error;
  }
}

/**
 * Publish UPDATE operation
 */
async function publishIndexUpdate(decomposedObjects) {
  try {
    for (const obj of decomposedObjects) {
      await publishIndexOperation(OPERATIONS.UPDATE, obj.value, {
        key: obj.key,
        objectType: obj.objectType,
        objectId: obj.objectId,
        parentKey: obj.parentKey,
        hasChildren: obj.children && obj.children.length > 0,
        childKeys: obj.children || []
      });
    }
    console.log('Published update operations:', decomposedObjects.length);
  } catch (error) {
    console.error('Error publishing index update:', error);
    throw error;
  }
}

module.exports = {
  publishIndexOperation,
  publishIndexCreate,
  publishIndexDelete,
  publishIndexUpdate,
  OPERATIONS
};
