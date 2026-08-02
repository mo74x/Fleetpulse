<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="FleetPulse Logo" />
</p>

<h1 align="center">FleetPulse</h1>
<p align="center">
  <b>A production-grade, event-driven logistics engine built with NestJS</b>
</p>
<p align="center">
  <a href="#architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-overview">API Overview</a> •
  <a href="#testing">Testing</a> •
  <a href="#ci-cd">CI/CD</a>
</p>

---

## Overview

**FleetPulse** is a real-time, last-mile delivery management platform designed for high-throughput logistics operations. It handles the full lifecycle of a delivery order — from ingestion and courier dispatch, through real-time GPS tracking, to financial settlement via a double-entry ledger — all within a polyglot-persistent, event-driven architecture.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                            FleetPulse Architecture                            │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────┐        ┌─────────────────────────────────────────────┐      │
│   │   Client /   │  HTTP  │              NestJS Gateway                │      │
│   │  Swagger UI  │───────▶│                                             │      │
│   └─────────────┘        │  ┌────────────┐  ┌───────────────────────┐  │      │
│                          │  │   Auth      │  │   Orders Controller   │  │      │
│   ┌─────────────┐        │  │  (JWT +     │  │   • POST /orders      │  │      │
│   │   Driver    │  WS    │  │   RBAC)     │  │   • GET  /orders      │  │      │
│   │   Mobile    │────────│  └────────────┘  │   • GET  /orders/:id   │  │      │
│   │   App       │        │                  │   • PATCH /orders/:id  │  │      │
│   └─────────────┘        │  ┌────────────┐  └───────────────────────┘  │      │
│                          │  │  Dispatch   │  ┌───────────────────────┐  │      │
│                          │  │  Controller │  │   Search Controller   │  │      │
│                          │  │  + Gateway  │  │   • GET /search       │  │      │
│                          │  └─────┬──────┘  └──────────┬────────────┘  │      │
│                          └────────┼─────────────────────┼──────────────┘      │
│                                   │                     │                     │
│  ┌────────────────────────────────┼─────────────────────┼──────────────────┐  │
│  │              Data & Messaging Layer                                     │  │
│  │                                                                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │  │
│  │  │ MongoDB  │  │ Postgres │  │  Redis    │  │   RabbitMQ             │  │  │
│  │  │ (Orders) │  │ (Ledger) │  │ (Geo +   │  │   (Event Bus)          │  │  │
│  │  │          │  │          │  │  Locks +  │  │                        │  │  │
│  │  │          │  │          │  │  BullMQ)  │  │   order.delivered ──┐  │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────────────┼──┘  │  │
│  │                                                                  │     │  │
│  │  ┌──────────────┐                        ┌───────────────────────▼──┐  │  │
│  │  │Elasticsearch │                        │    Ledger Service        │  │  │
│  │  │ (Waybill     │                        │    (Double-Entry COD     │  │  │
│  │  │  Search)     │                        │     Settlement)          │  │  │
│  │  └──────────────┘                        └──────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### System Components

| Component | Technology | Purpose |
|---|---|---|
| **API Gateway** | NestJS + Express | REST API with Swagger documentation |
| **Auth** | Passport + JWT | Authentication with role-based access (Admin, Merchant, Courier) |
| **Orders** | MongoDB + Mongoose | Order ingestion, CRUD, and status lifecycle management |
| **Dispatch** | Redis GeoSets + Redlock | Geo-spatial courier lookup and concurrency-safe assignment |
| **Tracking** | Socket.IO (WebSocket) | Real-time driver GPS telemetry ingestion |
| **Search** | Elasticsearch | Fuzzy waybill search (tracking numbers, recipient names, cities) |
| **Ledger** | PostgreSQL + TypeORM | Double-entry bookkeeping for COD financial settlement |
| **Queue** | BullMQ (Redis) | Async order processing with exponential backoff retries |
| **Events** | RabbitMQ | Event-driven inter-service communication (`order.delivered`) |
| **Health** | @nestjs/terminus | Health checks for Postgres, MongoDB, Redis, Elasticsearch |
| **Rate Limiting** | @nestjs/throttler | Global rate limiting (100 req/min) |

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS 11
- **Language**: TypeScript 5
- **Databases**: MongoDB (documents), PostgreSQL (financials)
- **Cache/Geo**: Redis (GeoSets, distributed locks, BullMQ)
- **Search**: Elasticsearch 9
- **Messaging**: RabbitMQ (AMQP)
- **Real-time**: Socket.IO (WebSockets)
- **Auth**: JWT + Passport with RBAC
- **Docs**: Swagger/OpenAPI with Bearer Auth
- **CI/CD**: GitHub Actions

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/mo74x/Fleetpulse.git
cd Fleetpulse
```

### 2. Start infrastructure with Docker Compose

Create a `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: fleetpulse-mongo
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db

  postgres:
    image: postgres:16-alpine
    container_name: fleetpulse-postgres
    environment:
      POSTGRES_USER: fleetpulse
      POSTGRES_PASSWORD: fleetpulse_secret
      POSTGRES_DB: fleetpulse_ledger
    ports:
      - '5432:5432'
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: fleetpulse-redis
    ports:
      - '6379:6379'

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: fleetpulse-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - '5672:5672'
      - '15672:15672'

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    container_name: fleetpulse-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - 'ES_JAVA_OPTS=-Xms512m -Xmx512m'
    ports:
      - '9200:9200'
    volumes:
      - es_data:/usr/share/elasticsearch/data

volumes:
  mongo_data:
  pg_data:
  es_data:
```

```bash
docker compose up -d
```

### 3. Configure environment

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/fleetpulse

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=fleetpulse
POSTGRES_PASSWORD=fleetpulse_secret
POSTGRES_DB=fleetpulse_ledger

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URI=amqp://guest:guest@localhost:5672

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=1d
```

### 4. Install dependencies & run

```bash
npm install
npm run start:dev
```

The API will be available at:
- **HTTP API**: `http://localhost:3000`
- **Swagger UI**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/health`
- **RabbitMQ Dashboard**: `http://localhost:15672`

---

## API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Login and receive JWT |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/orders` | Create a new order (async via BullMQ) |
| `GET` | `/api/v1/orders` | List orders with pagination & filters |
| `GET` | `/api/v1/orders/:id` | Get order by ID or tracking number |
| `PATCH` | `/api/v1/orders/:id/status` | Update order status (state-machine validated) |

### Dispatch
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/dispatch/assign` | Assign nearest courier or specific courier (Redlock-protected) |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/search?q=<term>` | Fuzzy waybill search via Elasticsearch |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Terminus health check (Postgres, MongoDB, Redis, Elasticsearch) |

### WebSocket (Telemetry)
| Event | Namespace | Description |
|-------|-----------|-------------|
| `driver_location` | `/telemetry` | Real-time driver GPS coordinates ingestion |

---

## Order Status Lifecycle

```
PENDING ──▶ ASSIGNED ──▶ IN_TRANSIT ──▶ DELIVERED
   │            │             │
   └──▶ FAILED  └──▶ FAILED  └──▶ FAILED
```

Each status transition is validated by a state machine. Invalid transitions (e.g., `DELIVERED → PENDING`) return a `400 Bad Request`.

---

## Testing

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:cov
```

### Test Coverage

| Service | Tests | What's Covered |
|---------|-------|----------------|
| `OrdersService` | 10 | Order creation, queue enqueue, pagination, filters, findOne by ID/tracking, status transitions |
| `LedgerService` | 5 | COD payment processing, pessimistic locking, double-entry ledger entries, rollback on failure |
| `SearchService` | 7 | Index initialization, document indexing/updating, fuzzy search, error resilience |

---

## CI/CD

The project includes a GitHub Actions pipeline (`.github/workflows/ci.yml`) that runs on every push/PR to `main`:

1. **Lint** — ESLint with TypeScript rules
2. **Build** — TypeScript compilation
3. **Test** — Jest unit tests with coverage

---

## Project Structure

```
src/
├── auth/                    # JWT authentication & RBAC
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── roles.guard.ts
│   └── user.schema.ts
├── dispatch/                # Courier assignment & tracking
│   ├── dispatch/
│   │   ├── dispatch.controller.ts
│   │   └── dispatch.service.ts
│   ├── redis/
│   │   └── redis.service.ts
│   └── tracking/
│       └── tracking.gateway.ts
├── health/                  # Terminus health indicators
│   ├── health.controller.ts
│   └── health.module.ts
├── ledger/                  # Financial double-entry ledger
│   ├── entities/
│   │   ├── account.entity.ts
│   │   └── ledger-entry.entity.ts
│   ├── ledger.controller.ts
│   └── ledger.service.ts
├── orders/                  # Order CRUD & lifecycle
│   ├── dto/
│   │   ├── create-order.dto.ts
│   │   ├── order-query.dto.ts
│   │   └── update-order-status.dto.ts
│   ├── schemas/
│   │   └── order.schema.ts
│   ├── orders.controller.ts
│   └── orders.service.ts
├── search/                  # Elasticsearch waybill search
│   ├── search.controller.ts
│   └── search.service.ts
├── app.module.ts
└── main.ts
```

---

## License

This project is [MIT licensed](LICENSE).
