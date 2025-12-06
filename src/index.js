const http = require('http');
const app = require('./app');
const { client } = require('./parser/utils/services/redis');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Close HTTP server (stop accepting new connections)
    server.close(() => {
        console.log('HTTP server closed');
    });

    // Close Redis connection
    try {
        if (client.isOpen) {
            await client.quit();
            console.log('Redis connection closed');
        }
    } catch (error) {
        console.error('Error closing Redis connection:', error);
    }

    console.log('Graceful shutdown complete');
    process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});