# Advanced Big Data Indexing

**Name**: Ishan Joshi
**Email**: joshi.ishan@northeastern.edu

A RESTful API for managing healthcare plans with advanced features including:
- Full CRUD operations (Create, Read, Update, Patch, Delete)
- Conditional reads and writes using ETags (If-Match, If-None-Match)
- Google OAuth 2.0 authentication with RS256 token signing
- Deep merge support for partial updates (PATCH)
- Redis-based storage with JSON validation

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [pnpm](https://pnpm.io/) (v8+ recommended)
- [Docker](https://www.docker.com/)
- [docker-compose](https://docs.docker.com/compose/)

## Local Setup

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

Create a `.env` file in the project root (use `.env.example` as template):

```bash
cp .env.example .env
```

Edit `.env` and update values as needed.

#### Sample `.env` file

```env
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=advanced_data_indexing

# Google OAuth2 Configuration
# Get this from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Important**: You must configure Google OAuth 2.0 credentials. See [AUTHENTICATION.md](./AUTHENTICATION.md) for detailed setup instructions.

### 4. Start Services with Docker Compose

```bash
docker-compose up -d
```

### 5. Start the Application

```bash
pnpm dev
```

Server runs at `http://localhost:3000`

---

## API Reference

**Base URL**: `http://localhost:3000/v1/plan`

All endpoints require authentication: `Authorization: Bearer YOUR_GOOGLE_TOKEN`

See [AUTHENTICATION.md](./AUTHENTICATION.md) for OAuth setup and token generation.

### Endpoints

| Method | Endpoint | Description | Special Headers |
|--------|----------|-------------|-----------------|
| POST | `/v1/plan` | Create plan | Returns ETag |
| GET | `/v1/plan/:id` | Get plan | `If-None-Match` for conditional read |
| PUT | `/v1/plan/:id` | Replace plan (full) | `If-Match` for conditional write |
| PATCH | `/v1/plan/:id` | Update plan (merge) | `If-Match` for conditional write |
| DELETE | `/v1/plan/:id` | Delete plan | - |

### Example Requests

**Create**:
```bash
curl -X POST http://localhost:3000/v1/plan \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"objectId": "plan123", "planName": "Health Plan", "cost": 1000}'
```

**Get** (saves ETag for later):
```bash
curl -i http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer TOKEN"
# Response includes: ETag: abc123
```

**Update with ETag check**:
```bash
curl -X PATCH http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer TOKEN" \
  -H "If-Match: abc123" \
  -H "Content-Type: application/json" \
  -d '{"cost": 1500}'
# Returns 412 if resource was modified by someone else
```

---

## Key Features

- **ETags**: Prevent lost updates (conditional writes) and reduce bandwidth (conditional reads)
- **PUT vs PATCH**: PUT replaces entire resource, PATCH merges changes
- **OAuth 2.0**: Google IDP with RS256 token signing
- **Redis Storage**: Fast in-memory data store

---

## Useful Commands

- `pnpm install` &mdash; Install dependencies
- `pnpm dev` &mdash; Start development server
- `docker-compose up -d` &mdash; Start services in background
- `docker-compose down` &mdash; Stop services
- `docker exec -it redis_server redis-cli -a advanced_data_indexing` for interactive redis cli

---

## Troubleshooting

- **401 Unauthorized**: Check your Google token is valid and not expired (tokens last ~1 hour)
- **Redis connection failed**: Ensure `docker-compose up -d` is running
- **Missing GOOGLE_CLIENT_ID**: Set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

For detailed auth setup, see [AUTHENTICATION.md](./AUTHENTICATION.md)

