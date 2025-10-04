# Demo 1

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [pnpm](https://pnpm.io/) (v8+ recommended)
- [Docker](https://www.docker.com/)
- [docker-compose](https://docs.docker.com/compose/)

## Local Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Create a `.env` file in the project root:

Edit `.env` and update values as needed.

#### Sample `.env` file

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=advanced_data_indexing
```

### 4. Start Services with Docker Compose

```bash
docker-compose up -d
```

### 5. Start the Application

```bash
pnpm dev
```

---

## Useful Commands

- `pnpm install` &mdash; Install dependencies
- `pnpm dev` &mdash; Start development server
- `docker-compose up -d` &mdash; Start services in background
- `docker-compose down` &mdash; Stop services

---

## Troubleshooting

- Ensure all environment variables are set in `.env`.
- Make sure Docker and docker-compose are running.

