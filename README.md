# Advanced Big Data Indexing

**Name**: Ishan Joshi  
**Email**: joshi.ishan@northeastern.edu

A production-ready RESTful API for managing healthcare plans with advanced big data indexing features including parent-child relationships, queuing, and real-time search capabilities.

## 🚀 Features

### Core Functionality
- ✅ **Full CRUD Operations** - Create, Read, Update, Patch, Delete with validation
- ✅ **Structured JSON Support** - Handle complex nested healthcare plan data
- ✅ **JSON Schema Validation** - Enforce data integrity using JSON Schema Draft 7
- ✅ **Deep Merge Support** - Partial updates with PATCH operations
- ✅ **Cascaded Delete** - Automatically delete parent and all child objects

### Advanced Features
- ✅ **Key Generation System** - Hierarchical keys (`objectType:objectId`) for organized storage
- ✅ **Object Decomposition** - Nested JSON decomposed into flat key-value pairs
- ✅ **Parent-Child Tracking** - Maintain relationships between nested objects
- ✅ **Conditional Operations** - ETags for optimistic locking (If-Match, If-None-Match)
- ✅ **Update If Not Changed** - Prevent lost updates with ETag validation

### Queuing & Indexing
- ✅ **RabbitMQ Integration** - Asynchronous message queuing for index operations
- ✅ **Elasticsearch Indexing** - Parent-child document indexing with join relations
- ✅ **Storage Mode Toggle** - MINIMAL (reference format) or FULL (complete objects)
- ✅ **Real-time Search** - Complex queries including parent-child relationships
- ✅ **Retry Logic** - Automatic retry on indexing failures (max 3 attempts)
- ✅ **Dead Letter Queue (DLQ)** - Failed messages stored for replay and investigation
- ✅ **PATCH to Index** - Partial updates propagate to Elasticsearch

### Security & Performance
- ✅ **Google OAuth 2.0** - Secure authentication with RS256 token signing
- ✅ **Redis Storage** - Fast in-memory key-value store with persistent connection pooling
- ✅ **Atomic Operations** - Redis pipelines and SET NX prevent race conditions
- ✅ **Graceful Shutdown** - Clean resource cleanup on process termination

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v16+ 
- [pnpm](https://pnpm.io/) v8+
- [Docker](https://www.docker.com/) & [docker-compose](https://docs.docker.com/compose/)

---

## 🛠️ Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Ishan25j/advanced_big_data_indexing.git
cd advanced_big_data_indexing
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

**Sample `.env` file:**

```env
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=advanced_data_indexing

# RabbitMQ Configuration
RABBITMQ_URL=amqp://admin:admin@localhost:5672

# Elasticsearch Configuration
ES_HOST=http://localhost:9200

# Elasticsearch Storage Mode
# Options: 'MINIMAL' or 'FULL' (default: FULL)
ES_STORAGE_MODE=FULL

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Important**: Configure Google OAuth 2.0 credentials from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). See [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md) for detailed setup.

### 4. Start Services with Docker Compose

```bash
docker-compose up -d
```

This starts:
- **Redis** (port 6379) - Key-value storage
- **RabbitMQ** (ports 5672, 15672) - Message queue
- **Elasticsearch** (port 9200) - Search engine
- **Kibana** (port 5601) - Elasticsearch UI

### 5. Start the Application

#### Option 1: Quick Start (Recommended)

Use the provided startup script to start all services automatically:

```bash
./run.sh
```

This will:
1. Start Docker containers (RabbitMQ, Redis, Elasticsearch)
2. Wait for all services to be ready
3. Start the API server (background process)
4. Start the RabbitMQ consumer (background process)
5. Save process IDs and create log files

**To stop all services:**
```bash
./stop.sh
```

**View logs:**
```bash
tail -f logs/api.log      # API server logs
tail -f logs/consumer.log # Consumer logs
```

#### Option 2: Manual Start

```bash
# Terminal 1: Start API server
pnpm dev

# Terminal 2: Start consumer (in a new terminal)
node src/consumer.js
```

**Service URLs:**
- API: `http://localhost:3000`
- RabbitMQ Management: `http://localhost:15672` (admin/admin)
- Kibana Dev Tools: `http://localhost:5601/app/dev_tools#/console`

---

## 📖 API Reference

**Base URL**: `http://localhost:3000/v1/plan`

All endpoints require: `Authorization: Bearer YOUR_GOOGLE_TOKEN`

### Endpoints

| Method | Endpoint | Description | Returns |
|--------|----------|-------------|---------|
| POST | `/v1/plan` | Create a new plan | 201 + ETag |
| GET | `/v1/plan/:objectId` | Get plan by ID | 200 + ETag or 304 |
| PUT | `/v1/plan/:objectId` | Replace entire plan | 200 + ETag or 412 |
| PATCH | `/v1/plan/:objectId` | Partial update (merge) | 200 + ETag or 412 |
| DELETE | `/v1/plan/:objectId` | Delete plan + children | 204 |

### Example Requests

#### Create Plan

```bash
POST /v1/plan
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "objectId": "plan123",
  "objectType": "plan",
  "planType": "inNetwork",
  "creationDate": "05-12-2024",
  "_org": "example.com",
  "planCostShares": {
    "objectId": "cost456",
    "objectType": "membercostshare",
    "deductible": 2000,
    "copay": 50,
    "_org": "example.com"
  },
  "linkedPlanServices": [
    {
      "objectId": "service789",
      "objectType": "planservice",
      "_org": "example.com",
      "linkedService": {
        "objectId": "srv111",
        "objectType": "service",
        "name": "Annual Checkup",
        "_org": "example.com"
      },
      "planserviceCostShares": {
        "objectId": "srvCost222",
        "objectType": "membercostshare",
        "deductible": 100,
        "copay": 20,
        "_org": "example.com"
      }
    }
  ]
}
```

**Response:**
```json
{
  "message": "Object created successfully",
  "objectId": "plan123",
  "objectType": "plan",
  "key": "plan:plan123",
  "decomposedCount": 5,
  "data": { ... }
}
```

#### Get Plan

```bash
GET /v1/plan/plan123
Authorization: Bearer YOUR_TOKEN
If-None-Match: "abc123"  # Optional: returns 304 if not modified
```

**Response (200):**
```json
{
  "objectId": "plan123",
  "objectType": "plan",
  "planType": "inNetwork",
  ...full nested structure...
}
```

#### Patch Plan (Partial Update)

```bash
PATCH /v1/plan/plan123
Authorization: Bearer YOUR_TOKEN
If-Match: "abc123"  # Optional: prevents lost updates
Content-Type: application/json

{
  "planCostShares": {
    "deductible": 2500
  }
}
```

**What happens:**
1. Fetches full plan from Redis
2. Deep merges your changes
3. Re-decomposes and stores in Redis
4. **Publishes to RabbitMQ** → Consumer indexes to Elasticsearch ✨

#### Delete Plan (Cascaded)

```bash
DELETE /v1/plan/plan123
Authorization: Bearer YOUR_TOKEN
```

**What happens:**
1. Finds all child objects recursively
2. Deletes from Redis (plan + all children + metadata)
3. Publishes to RabbitMQ → Consumer deletes from Elasticsearch

---

## 🗄️ Data Storage Architecture

### Redis Key Structure

Each object gets three keys:

```
plan:plan123                      → Main object data
plan:plan123:children             → Set of child keys
plan:plan123:metadata             → Parent info, type, hasChildren flag

membercostshare:cost456           → Child object data
membercostshare:cost456:metadata  → Parent: plan:plan123
```

### Parent-Child Relationships

```
Plan (plan:plan123)
├── planCostShares (membercostshare:cost456)
└── linkedPlanServices (planservice:service789)
    ├── linkedService (service:srv111)
    └── planserviceCostShares (membercostshare:srvCost222)
```

---

## 🔍 Elasticsearch Search

### Index Structure

**Index Name**: `healthcare_plans`

**Parent-Child Mapping:**
```
plan (root)
├── planCostShares (child)
└── linkedPlanServices (child)
    ├── linkedService (grandchild)
    └── planserviceCostShares (grandchild)
```

### Example Queries

Open **Kibana Dev Tools** at `http://localhost:5601/app/dev_tools#/console`

**Get all documents:**
```json
GET /healthcare_plans/_search
{
  "query": {
    "match_all": {}
  }
}
```

**Find plans with deductible >= 2000:**
```json
GET /healthcare_plans/_search
{
  "query": {
    "has_child": {
      "type": "planCostShares",
      "query": {
        "range": {
          "deductible": { "gte": 2000 }
        }
      }
    }
  }
}
```

**Find all children of a plan:**
```json
GET /healthcare_plans/_search
{
  "query": {
    "has_parent": {
      "parent_type": "plan",
      "query": {
        "term": { "objectId": "plan123" }
      }
    }
  }
}
```

📝 **More queries**: See `elasticsearch_queries.txt` (40+ ready-to-use queries)

---

## ⚙️ Elasticsearch Storage Modes

The system supports two storage modes for Elasticsearch indexing, configurable via the `ES_STORAGE_MODE` environment variable.

### MINIMAL Mode (Reference Format)

**Use when:**
- You want to match the reference implementation exactly
- You need minimal storage overhead
- You only care about searchable fields

**Document Structure:**
```json
{
  "_id": "27283xvx9sdf-507",
  "_routing": "12xvxc345ssdsds-508",
  "_source": {
    "objectId": "27283xvx9sdf-507",
    "objectType": "planservice",
    "_org": "example.com",
    "copay": 175,
    "deductible": 10,
    "plan_join": {
      "name": "linkedPlanServices",
      "parent": "12xvxc345ssdsds-508"
    }
  }
}
```

**Stored Fields:**
- ✅ `objectId`, `objectType`, `_org`
- ✅ Direct scalar fields: `planType`, `creationDate`, `deductible`, `copay`, `name`
- ❌ No nested object references

### FULL Mode (Default - Enhanced)

**Use when:**
- You want complete object data in Elasticsearch
- You need to see child references
- You want easier debugging
- You want type-safe document IDs

**Document Structure:**
```json
{
  "_id": "planservice:27283xvx9sdf-507",
  "_routing": "plan:12xvxc345ssdsds-508",
  "_source": {
    "objectId": "27283xvx9sdf-507",
    "objectType": "planservice",
    "_org": "example.com",
    "linkedService": {
      "objectId": "1234520xvc30sfs-505",
      "objectType": "service",
      "_org": "example.com"
    },
    "planserviceCostShares": {
      "objectId": "1234512xvc1314sdfsd-506",
      "objectType": "membercostshare",
      "_org": "example.com"
    },
    "plan_join": {
      "name": "linkedPlanServices",
      "parent": "plan:12xvxc345ssdsds-508"
    }
  }
}
```

**Stored Fields:**
- ✅ Complete decomposed object structure
- ✅ All nested object references
- ✅ Type-prefixed document IDs (prevents collisions)
- ✅ Type-prefixed routing

### Mode Comparison

| Feature | MINIMAL | FULL |
|---------|---------|------|
| Document ID | `objectId` | `type:objectId` |
| Routing | `parentObjectId` | `type:parentObjectId` |
| Nested References | ❌ Not stored | ✅ Stored |
| Collision Safety | ⚠️ Possible if IDs overlap | ✅ Type-prefixed |
| Storage Size | 🟢 Smaller | 🟡 Larger |
| Debug Info | 🟡 Limited | 🟢 Complete |

### Switching Modes

**1. Update `.env`:**
```bash
# For minimal mode (reference format)
ES_STORAGE_MODE=MINIMAL

# For full mode (default)
ES_STORAGE_MODE=FULL
```

**2. Delete existing index in Kibana Dev Tools:**
```
DELETE /healthcare_plans
```

**3. Restart consumer:**
```bash
# Stop current consumer (Ctrl+C)
# Start new consumer
node src/consumer.js
```

**4. Re-index data:**
```bash
# Create your plans again via API
POST http://localhost:3000/v1/plan
```

**Note:** Both modes are **functionally equivalent** for search queries! The difference is only in what data is stored in Elasticsearch documents.

📝 **Detailed comparison**: See [docs/ES_STORAGE_MODES.md](./docs/ES_STORAGE_MODES.md)

---

## 🐰 Message Queue Flow

### Create/Update Flow

```
API POST/PATCH Request
       ↓
1. Validate & Decompose
2. Store in Redis (atomic SET NX prevents race conditions)
3. Publish to RabbitMQ Queue ← queue: index_queue
       ↓
Consumer (node src/consumer.js)
       ↓
4. Index to Elasticsearch
   ├── Success → ACK message
   └── Failure → Retry (max 3 attempts)
                 └── Still failing? → Send to Dead Letter Queue (DLQ)
```

### Delete Flow

```
API DELETE Request
       ↓
1. Find all children recursively
2. Delete from Redis (cascaded)
3. Publish to RabbitMQ Queue
       ↓
Consumer
       ↓
4. Delete from Elasticsearch (cascaded with parent routing)
   ├── Success → ACK message
   └── Failure → Retry → DLQ if max retries exceeded
```

### Dead Letter Queue (DLQ)

Messages are sent to the DLQ (`index_queue_dlq`) when:
- Max retries exceeded (3 attempts)
- Malformed JSON (cannot be parsed)
- Persistent processing errors

**DLQ Features:**
- 24-hour message retention
- Rich failure metadata (reason, timestamp, retry count)
- Manual replay capability via RabbitMQ UI
- Monitoring via RabbitMQ Management Console

📝 **DLQ Usage Guide**: See [docs/DLQ_USAGE_GUIDE.md](./docs/DLQ_USAGE_GUIDE.md)

---

## 🧪 Testing

### 1. Check Services

```bash
# Check all Docker services
docker-compose ps

# Check Redis
docker exec -it redis_server redis-cli -a advanced_data_indexing
127.0.0.1:6379> KEYS *

# Check RabbitMQ
open http://localhost:15672  # admin/admin

# Check Elasticsearch
curl http://localhost:9200/_cluster/health?pretty
```

### 2. Test API

```bash
# Create a plan
curl -X POST http://localhost:3000/v1/plan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @sample_plan.json

# Get the plan
curl http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Verify in Elasticsearch

**In Kibana Dev Tools:**
```json
GET /healthcare_plans/_search

GET /healthcare_plans/_search
{
  "size": 0,
  "aggs": {
    "types": {
      "terms": { "field": "objectType" }
    }
  }
}
```

---

## 📂 Project Structure

```
.
├── src/
│   ├── app.js                 # Express app setup
│   ├── index.js               # Server entry point (with graceful shutdown)
│   ├── consumer.js            # RabbitMQ consumer starter
│   ├── events/                # Queuing & Indexing
│   │   ├── rabbitmq.js        # RabbitMQ connection + DLQ setup
│   │   ├── publisher.js       # Publish index operations
│   │   ├── consumer.js        # Consume & index to ES (with DLQ)
│   │   └── elasticsearch.js   # ES client & operations
│   └── parser/
│       ├── routes/            # API endpoints
│       │   ├── create.js      # POST /v1/plan (with race condition fix)
│       │   ├── get.js         # GET /v1/plan/:id
│       │   ├── update.js      # PUT /v1/plan/:id
│       │   ├── patch.js       # PATCH /v1/plan/:id
│       │   └── del.js         # DELETE /v1/plan/:id
│       ├── middleware/        # Auth & Validation
│       │   ├── auth.js        # Google OAuth validation
│       │   └── validate_valid_json.js
│       └── utils/
│           ├── keyGenerator.js        # Generate Redis keys
│           ├── objectDecomposer.js    # Decompose nested JSON
│           ├── etag/etag.js           # ETag generation
│           ├── services/redis.js      # Redis persistent connection
│           └── models/schema.json     # JSON schema
├── docs/                      # Documentation
│   ├── AUTHENTICATION.md      # Google OAuth setup
│   ├── ES_STORAGE_MODES.md    # Storage mode comparison
│   ├── DLQ_USAGE_GUIDE.md     # Dead Letter Queue guide
│   └── BUG_FIXES_2025-12-06.md # Recent bug fixes
├── logs/                      # Application logs (gitignored)
│   ├── api.log               # API server logs
│   └── consumer.log          # Consumer logs
├── run.sh                     # Startup script
├── stop.sh                    # Shutdown script
├── docker-compose.yml         # Services config
├── elasticsearch_queries.txt  # 40+ test queries
├── package.json
└── README.md
```

---

## 🎯 Demo Requirements Coverage

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| REST API with CRUD | ✅ | All routes in `src/parser/routes/` |
| Handle structured JSON | ✅ | JSON schema validation |
| Merge support | ✅ | Deep merge in PATCH route |
| Cascaded delete | ✅ | Recursive delete from KV + ES with parent routing |
| Validation | ✅ | JSON Schema Draft 7 + AJV |
| Update if not changed | ✅ | ETag with If-Match header |
| Key-value store | ✅ | Redis with hierarchical keys + persistent connection |
| Parent-child indexing | ✅ | ES join field with relations (MINIMAL & FULL modes) |
| PATCH to index | ✅ | Queue → Consumer → ES |
| Queueing | ✅ | RabbitMQ with retry logic + Dead Letter Queue |
| Security | ✅ | Google OAuth 2.0 + Race condition prevention |

## 🆕 Recent Improvements (December 2025)

| Improvement | Description |
|-------------|-------------|
| **Redis Connection Management** | Fixed connection leak by implementing persistent connection pooling |
| **Race Condition Fix** | Atomic SET NX operation prevents duplicate object creation |
| **Dead Letter Queue** | Failed messages stored with rich metadata for replay and investigation |
| **Graceful Shutdown** | Clean resource cleanup on SIGTERM/SIGINT signals |
| **Metadata Key Consistency** | Centralized `generateMetadataKey()` utility for consistent key generation |
| **Consumer Reliability** | Fixed async/await bugs and JSON parse error handling |
| **Startup Scripts** | `run.sh` and `stop.sh` for easy service management |

📝 **Full details**: See [docs/BUG_FIXES_2025-12-06.md](./docs/BUG_FIXES_2025-12-06.md)

---

## 🔧 Useful Commands

```bash
# Quick Start/Stop
./run.sh                  # Start everything (Docker + API + Consumer)
./stop.sh                 # Stop everything gracefully
tail -f logs/api.log      # View API logs
tail -f logs/consumer.log # View consumer logs

# Development
pnpm install              # Install dependencies
pnpm dev                  # Start API server
node src/consumer.js      # Start consumer

# Docker
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose ps         # Check service status
docker-compose logs -f    # View logs

# Redis CLI
docker exec -it redis_server redis-cli -a advanced_data_indexing
> KEYS *
> GET plan:plan123
> SMEMBERS plan:plan123:children
> GET plan:plan123:metadata

# RabbitMQ
open http://localhost:15672   # Management UI (admin/admin)
# View queues: index_queue, index_queue_dlq

# Elasticsearch
open http://localhost:5601    # Kibana
curl http://localhost:9200/_cat/indices?v
curl http://localhost:9200/healthcare_plans/_count
```

---

## 🐛 Troubleshooting

### API Issues

**401 Unauthorized**
- Check Google token validity (tokens expire after ~1 hour)
- Verify `GOOGLE_CLIENT_ID` in `.env`
- See [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md)

**500 Internal Server Error**
- Check Redis is running: `docker-compose ps`
- Check logs: `docker-compose logs redis`

### Elasticsearch Issues

**No search results**
- **Consumer not running**: Start with `node src/consumer.js`
- Check RabbitMQ queue: http://localhost:15672
- Check messages are being processed in consumer logs

**Index not found**
- Consumer creates index on first start
- Manually create: See `src/events/elasticsearch.js`

**Query results look different than expected**
- Check `ES_STORAGE_MODE` in `.env` (MINIMAL vs FULL)
- MINIMAL mode stores minimal metadata (matches reference)
- FULL mode stores complete objects (better debugging)
- See [docs/ES_STORAGE_MODES.md](./docs/ES_STORAGE_MODES.md) for details

### RabbitMQ Issues

**Connection refused**
- Ensure RabbitMQ is running: `docker-compose ps`
- Check URL in `.env`: `RABBITMQ_URL=amqp://admin:admin@localhost:5672`

**Messages not being consumed**
- Restart consumer: `node src/consumer.js`
- Check queue has consumers in management UI

**Messages in Dead Letter Queue (DLQ)**
- Check `index_queue_dlq` in RabbitMQ Management UI
- Review failure reasons in message headers
- Fix root cause (e.g., restart Elasticsearch, fix code bug)
- Replay messages from DLQ back to main queue
- See [docs/DLQ_USAGE_GUIDE.md](./docs/DLQ_USAGE_GUIDE.md) for detailed procedures

---

## 📚 Additional Documentation

- **[docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md)** - Google OAuth 2.0 setup guide
- **[docs/ES_STORAGE_MODES.md](./docs/ES_STORAGE_MODES.md)** - Elasticsearch storage mode comparison (MINIMAL vs FULL)
- **[docs/DLQ_USAGE_GUIDE.md](./docs/DLQ_USAGE_GUIDE.md)** - Dead Letter Queue usage, monitoring, and replay
- **[docs/BUG_FIXES_2025-12-06.md](./docs/BUG_FIXES_2025-12-06.md)** - Recent bug fixes and improvements (Dec 2025)
- **[elasticsearch_queries.txt](./elasticsearch_queries.txt)** - 40+ test queries for Kibana Dev Tools

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

ISC

---

## 👤 Author

**Ishan Joshi**  
Email: joshi.ishan@northeastern.edu  
GitHub: [@Ishan25j](https://github.com/Ishan25j)
