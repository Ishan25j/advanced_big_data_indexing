/**
 * RabbitMQ Connection Utility
 */

const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
const EXCHANGE_NAME = 'index_exchange';
const QUEUE_NAME = 'index_queue';
const DLQ_NAME = 'index_queue_dlq';  // Dead Letter Queue
const ROUTING_KEY = 'index.operation';

let connection = null;
let channel = null;

async function connect() {
  try {
    if (connection) {
      console.log('RabbitMQ: Already connected');
      return connection;
    }

    connection = await amqp.connect(RABBITMQ_URL);
    console.log('RabbitMQ: Connected successfully');

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      connection = null;
      channel = null;
    });

    return connection;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

async function createChannel() {
  try {
    if (channel) {
      return channel;
    }

    if (!connection) {
      await connect();
    }

    channel = await connection.createChannel();
    console.log('RabbitMQ: Channel created');

    await channel.assertExchange(EXCHANGE_NAME, 'topic', {
      durable: true
    });

    await channel.assertQueue(QUEUE_NAME, {
      durable: true
    });

    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

    // Create Dead Letter Queue for failed messages
    await channel.assertQueue(DLQ_NAME, {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000  // Messages expire after 24 hours (optional cleanup)
      }
    });

    console.log('RabbitMQ: Exchange, main queue, and DLQ setup complete');

    return channel;
  } catch (error) {
    console.error('Failed to create RabbitMQ channel:', error);
    throw error;
  }
}

async function close() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }

    if (connection) {
      await connection.close();
      connection = null;
    }

    console.log('RabbitMQ: Connection closed');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
}

async function getChannel() {
  if (!channel) {
    return await createChannel();
  }
  return channel;
}

module.exports = {
  connect,
  createChannel,
  getChannel,
  close,
  EXCHANGE_NAME,
  QUEUE_NAME,
  DLQ_NAME,
  ROUTING_KEY
};
