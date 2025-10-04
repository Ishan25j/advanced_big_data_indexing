const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  password: process.env.REDIS_PASSWORD || 'advanced_data_indexing',
});

// client.on('error', (err) => {
//   console.error('Redis error:', err);
// });

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log('Connected to Redis');
  }
}

module.exports = { client, connectRedis };