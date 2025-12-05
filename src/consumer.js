/**
 * RabbitMQ Consumer Starter
 * 
 * Run this separately to consume messages and index to Elasticsearch
 * Usage: node src/consumer.js
 */

const { startConsumer } = require('./events/consumer');
const { connect } = require('./events/rabbitmq');

async function main() {
  try {
    console.log('='.repeat(50));
    console.log('Starting RabbitMQ Consumer for Elasticsearch Indexing');
    console.log('='.repeat(50));

    // Connect to RabbitMQ
    await connect();

    // Start consuming messages
    await startConsumer();

    console.log('Consumer is running. Press Ctrl+C to stop.');

  } catch (error) {
    console.error('Fatal error starting consumer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down consumer...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down consumer...');
  process.exit(0);
});

// Start the consumer
main();
