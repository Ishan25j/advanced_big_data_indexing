#!/bin/bash

# Advanced Big Data Indexing - Startup Script
# Starts all required services: Docker containers, API server, and RabbitMQ consumer

set -e  # Exit on error

echo "========================================"
echo "Starting Advanced Big Data Indexing"
echo "========================================"
echo ""

# 1. Start Docker Compose (RabbitMQ, Redis, Elasticsearch)
echo "[1/4] Starting Docker containers (RabbitMQ, Redis, Elasticsearch)..."
docker-compose up -d

echo ""
echo "[2/4] Waiting for services to be ready..."
echo "  - Waiting for Redis (port 6379)..."
while ! nc -z localhost 6379 2>/dev/null; do
    sleep 1
done
echo "  ✓ Redis is ready"

echo "  - Waiting for RabbitMQ (port 5672)..."
while ! nc -z localhost 5672 2>/dev/null; do
    sleep 1
done
echo "  ✓ RabbitMQ is ready"

echo "  - Waiting for Elasticsearch (port 9200)..."
while ! curl -s http://localhost:9200/_cluster/health >/dev/null 2>&1; do
    sleep 1
done
echo "  ✓ Elasticsearch is ready"

echo ""
echo "[3/4] Starting API Server..."
# Start API server in background, redirect output to log file
nohup node src/index.js > logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > .api.pid
echo "  ✓ API Server started (PID: $API_PID)"
echo "  → Logs: logs/api.log"

echo ""
echo "[4/4] Starting RabbitMQ Consumer..."
# Start consumer in background, redirect output to log file
nohup node src/consumer.js > logs/consumer.log 2>&1 &
CONSUMER_PID=$!
echo $CONSUMER_PID > .consumer.pid
echo "  ✓ Consumer started (PID: $CONSUMER_PID)"
echo "  → Logs: logs/consumer.log"

echo ""
echo "========================================"
echo "✓ All services started successfully!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  - API Server:          http://localhost:3000"
echo "  - RabbitMQ Management: http://localhost:15672 (admin/admin)"
echo "  - Elasticsearch:       http://localhost:9200"
echo ""
echo "Process IDs:"
echo "  - API Server:  $API_PID (saved to .api.pid)"
echo "  - Consumer:    $CONSUMER_PID (saved to .consumer.pid)"
echo ""
echo "To stop all services, run: ./stop.sh"
echo "To view logs:"
echo "  - API:      tail -f logs/api.log"
echo "  - Consumer: tail -f logs/consumer.log"
echo ""
