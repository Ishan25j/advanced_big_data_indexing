const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  password: process.env.REDIS_PASSWORD || 'advanced_data_indexing',
});

// Error handler for Redis connection issues
client.on('error', (err) => {
  console.error('Redis error:', err);
});

// Connection event handlers for monitoring
client.on('connect', () => {
  console.log('Redis client connected');
});

client.on('ready', () => {
  console.log('Redis client ready');
});

client.on('reconnecting', () => {
  console.warn('Redis client reconnecting...');
});

client.on('end', () => {
  console.warn('Redis connection closed');
});

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log('Connected to Redis');
  }
}

module.exports = { client, connectRedis };