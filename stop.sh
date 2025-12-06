#!/bin/bash

# Advanced Big Data Indexing - Shutdown Script
# Stops all running services: API server, RabbitMQ consumer, and Docker containers

echo "========================================"
echo "Stopping Advanced Big Data Indexing"
echo "========================================"
echo ""

# 1. Stop API Server
echo "[1/3] Stopping API Server..."
if [ -f .api.pid ]; then
    API_PID=$(cat .api.pid)
    if ps -p $API_PID > /dev/null 2>&1; then
        kill $API_PID
        echo "  ✓ API Server stopped (PID: $API_PID)"
    else
        echo "  ⚠ API Server not running (PID $API_PID not found)"
    fi
    rm -f .api.pid
else
    echo "  ⚠ No .api.pid file found, attempting to find process..."
    pkill -f "node src/index.js" && echo "  ✓ API Server stopped" || echo "  ⚠ API Server not running"
fi

echo ""

# 2. Stop RabbitMQ Consumer
echo "[2/3] Stopping RabbitMQ Consumer..."
if [ -f .consumer.pid ]; then
    CONSUMER_PID=$(cat .consumer.pid)
    if ps -p $CONSUMER_PID > /dev/null 2>&1; then
        kill $CONSUMER_PID
        echo "  ✓ Consumer stopped (PID: $CONSUMER_PID)"
    else
        echo "  ⚠ Consumer not running (PID $CONSUMER_PID not found)"
    fi
    rm -f .consumer.pid
else
    echo "  ⚠ No .consumer.pid file found, attempting to find process..."
    pkill -f "node src/consumer.js" && echo "  ✓ Consumer stopped" || echo "  ⚠ Consumer not running"
fi

echo ""

# 3. Stop Docker Compose
echo "[3/3] Stopping Docker containers..."
docker-compose down
echo "  ✓ Docker containers stopped"

echo ""
echo "========================================"
echo "✓ All services stopped successfully!"
echo "========================================"
echo ""
