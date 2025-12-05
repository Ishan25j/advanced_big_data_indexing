/**
 * RabbitMQ Consumer/Listener
 *
 * Consumes messages from RabbitMQ queue and processes them
 * by indexing/deleting documents in Elasticsearch
 */

const { getChannel, QUEUE_NAME } = require('./rabbitmq');
const {
  initializeIndex,
  indexDocument,
  deleteDocument,
  updateDocument,
  healthCheck
} = require('./elasticsearch');

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Process a single message from the queue
 */
async function processMessage(message) {
  try {
    const content = JSON.parse(message.content.toString());
    const { operation, data, metadata } = content;

    console.log('Processing message:', operation, 'for key:', metadata.key);

    switch (operation) {
      case 'INDEX':
        await indexDocument(metadata.key, data, metadata);
        break;

      case 'DELETE':
        await deleteDocument(metadata.key, metadata.parentKey);
        break;

      case 'UPDATE':
        await updateDocument(metadata.key, data, metadata);
        break;

      default:
        console.warn('Unknown operation:', operation);
    }

    console.log('Successfully processed:', operation, 'for key:', metadata.key);
    return true;

  } catch (error) {
    console.error('Error processing message:', error);
    throw error;
  }
}

/**
 * Handle message retry logic
 */
async function handleMessage(message, channel) {
  try {
    const content = JSON.parse(message.content.toString());
    const retryCount = content.metadata.retryCount || 0;

    await processMessage(message);

    // Acknowledge successful processing
    channel.ack(message);

  } catch (error) {
    const content = JSON.parse(message.content.toString());
    const retryCount = content.metadata.retryCount || 0;

    if (retryCount < MAX_RETRIES) {
      // Retry: reject and requeue
      console.log('Retrying message, attempt:', retryCount + 1);
      content.metadata.retryCount = retryCount + 1;

      // Delay before retry
      setTimeout(() => {
        channel.nack(message, false, true);
      }, RETRY_DELAY);

    } else {
      // Max retries reached, send to dead letter queue or log
      console.error('Max retries reached for message, discarding:', content.metadata.key);
      channel.nack(message, false, false); // Don't requeue
    }
  }
}

/**
 * Start consuming messages from RabbitMQ
 */
async function startConsumer() {
  try {
    console.log('Starting RabbitMQ consumer...');

    // Initialize Elasticsearch index
    await initializeIndex();

    // Check Elasticsearch health
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      console.warn('Elasticsearch is not healthy, but continuing...');
    }

    // Get RabbitMQ channel
    const channel = await getChannel();

    // Set prefetch to process one message at a time
    await channel.prefetch(1);

    console.log('Waiting for messages in queue:', QUEUE_NAME);

    // Start consuming
    channel.consume(
      QUEUE_NAME,
      (message) => {
        if (message) {
          handleMessage(message, channel);
        }
      },
      {
        noAck: false // Manual acknowledgment
      }
    );

    console.log('Consumer started successfully');

  } catch (error) {
    console.error('Error starting consumer:', error);
    throw error;
  }
}

/**
 * Stop the consumer gracefully
 */
async function stopConsumer() {
  try {
    const channel = await getChannel();
    await channel.close();
    console.log('Consumer stopped');
  } catch (error) {
    console.error('Error stopping consumer:', error);
  }
}

module.exports = {
  startConsumer,
  stopConsumer,
  processMessage
};
