<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="FleetPulse Logo" />
</p>

<h1 align="center">FleetPulse</h1>
<p align="center">
  <b>A production-grade, event-driven logistics engine built with NestJS</b>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Elasticsearch-9-005571?style=for-the-badge&logo=elasticsearch&logoColor=white" alt="Elasticsearch" />
  <img src="https://img.shields.io/badge/RabbitMQ-3-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Kubernetes" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-data-models">Data Models</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-order-lifecycle">Order Lifecycle</a> •
  <a href="#-testing">Testing</a> •
  <a href="#-cicd--deployment">CI/CD</a>
</p>

---

## 📋 Overview

**FleetPulse** is a real-time, last-mile delivery management platform designed for high-throughput logistics operations. It handles the full lifecycle of a delivery order — from ingestion and courier dispatch, through real-time GPS tracking, to financial settlement via a double-entry ledger — all within a polyglot-persistent, event-driven architecture.

### ✨ Key Features

| Feature | Description |
|:--|:--|
| 🚚 **Async Order Ingestion** | Orders are accepted instantly and processed via BullMQ with exponential backoff retries (3 attempts) |
| 📍 **Geo-Spatial Dispatch** | Nearest courier assignment using Redis GeoSets with configurable radius search |
| 🔒 **Distributed Locking** | Redlock-based concurrency control prevents double-dispatch race conditions |
| 📡 **Real-Time Tracking** | Socket.IO WebSocket gateway for live driver GPS telemetry ingestion |
| 🔍 **Fuzzy Search** | Elasticsearch-powered waybill search across tracking numbers, names, and cities |
| 💰 **Double-Entry Ledger** | PostgreSQL-backed financial settlement with pessimistic locking and atomic transactions |
| 🔐 **JWT + RBAC** | Role-based access control with Admin, Merchant, and Courier roles |
| 🏥 **Health Monitoring** | Terminus-based health checks for all infrastructure dependencies |
| ⚡ **Rate Limiting** | Global throttling at 100 requests/minute to protect against abuse |
| 🐳 **Container-Ready** | Multi-stage Docker builds and Kubernetes manifests with HPA autoscaling |

---

## 🏗 Architecture

### High-Level System Diagram

```mermaid
graph TB
    subgraph Clients
        A[🖥️ Client / Swagger UI]
        B[📱 Driver Mobile App]
    end

    subgraph Gateway ["NestJS API Gateway"]
        C[🔐 Auth Module<br/>JWT + RBAC]
        D[📦 Orders Module<br/>CRUD + Lifecycle]
        E[🚚 Dispatch Module<br/>Geo + Assignment]
        F[🔍 Search Module<br/>Elasticsearch]
        G[💰 Ledger Module<br/>Double-Entry]
        H[🏥 Health Module<br/>Terminus]
        I[⚡ Throttler<br/>Rate Limiting]
    end

    subgraph Data ["Data & Messaging Layer"]
        J[(MongoDB<br/>Orders)]
        K[(PostgreSQL<br/>Ledger)]
        L[(Redis<br/>Geo + Locks + BullMQ)]
        M[Elasticsearch<br/>Waybill Index]
        N[RabbitMQ<br/>Event Bus]
    end

    A -- HTTP/REST --> C
    A -- HTTP/REST --> D
    A -- HTTP/REST --> F
    B -- WebSocket --> E

    D --> J
    D --> L
    G --> K
    E --> L
    F --> M
    D -- order.delivered --> N
    N -- consume --> G
    C --> J

    style Gateway fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#fff
    style Data fill:#0f3460,stroke:#16213e,stroke-width:2px,color:#fff
    style Clients fill:#16213e,stroke:#0f3460,stroke-width:2px,color:#fff
```

### Request Flow — Order Creation

```mermaid
sequenceDiagram
    participant Client
    participant API as NestJS Gateway
    participant Queue as BullMQ (Redis)
    participant Worker as Queue Worker
    participant DB as MongoDB
    participant ES as Elasticsearch
    participant MQ as RabbitMQ

    Client->>API: POST /api/v1/orders
    API->>API: Validate DTO (class-validator)
    API->>API: Generate Tracking Number (BSTA-XXXXXXXX-EG)
    API->>Queue: Enqueue job (3 retries, exponential backoff)
    API-->>Client: 202 { trackingNumber, message }

    Queue->>Worker: Process job
    Worker->>DB: Insert Order document
    Worker->>ES: Index waybill document
    Worker-->>Queue: Job complete

    Note over DB,ES: On status → DELIVERED
    DB->>MQ: Emit order.delivered event
    MQ->>API: Consume event (Ledger Service)
    API->>DB: Process COD settlement
```

### Request Flow — Courier Dispatch

```mermaid
sequenceDiagram
    participant Client
    participant API as Dispatch Controller
    participant Redis as Redis GeoSets
    participant Lock as Redlock
    participant DB as MongoDB

    Client->>API: POST /api/v1/dispatch/assign
    
    alt Auto-assign (no courierId)
        API->>Redis: GEOSEARCH couriers:locations<br/>within 5km radius
        Redis-->>API: Return sorted courier list
        API->>API: Select nearest courier
    end

    API->>Lock: Acquire lock (locks:order:dispatch:{id})
    Lock-->>API: Lock granted (TTL: 5s)
    
    API->>DB: Update order status → ASSIGNED
    API->>Lock: Release lock
    API-->>Client: 200 { success, orderId, courierId }

    Note over Lock: If lock fails →<br/>409 Conflict (race condition prevented)
```

### COD Financial Settlement

```mermaid
sequenceDiagram
    participant MQ as RabbitMQ
    participant Ledger as Ledger Service
    participant PG as PostgreSQL

    MQ->>Ledger: order.delivered event

    Ledger->>PG: BEGIN TRANSACTION
    Ledger->>PG: SELECT ... FOR UPDATE (Courier Account)
    Ledger->>PG: SELECT ... FOR UPDATE (Merchant Account)
    Ledger->>PG: SELECT ... FOR UPDATE (Platform Account)

    Note over PG: Pessimistic Write Locks<br/>prevent race conditions

    Ledger->>PG: UPDATE courier.balance += codAmount
    Ledger->>PG: UPDATE merchant.balance += (codAmount - fee)
    Ledger->>PG: UPDATE platform.balance += fee

    Ledger->>PG: INSERT ledger_entry (courier, credit)
    Ledger->>PG: INSERT ledger_entry (merchant, credit)
    Ledger->>PG: INSERT ledger_entry (platform, credit)

    Ledger->>PG: COMMIT TRANSACTION
    Ledger-->>MQ: ACK message

    Note over PG: On failure → ROLLBACK<br/>entire transaction
```

### System Components

| Component | Technology | Purpose |
|:--|:--|:--|
| **API Gateway** | NestJS + Express | REST API with Swagger/OpenAPI documentation |
| **Auth** | Passport + JWT + bcrypt | Authentication with role-based access (Admin, Merchant, Courier) |
| **Orders** | MongoDB + Mongoose | Order ingestion, CRUD, and status lifecycle management |
| **Dispatch** | Redis GeoSets + Redlock | Geo-spatial courier lookup and concurrency-safe assignment |
| **Tracking** | Socket.IO (WebSocket) | Real-time driver GPS telemetry ingestion via `/telemetry` namespace |
| **Search** | Elasticsearch 9 | Fuzzy waybill search (tracking numbers, recipient names, cities) |
| **Ledger** | PostgreSQL + TypeORM | Double-entry bookkeeping for COD financial settlement |
| **Queue** | BullMQ (Redis) | Async order processing with 3x exponential backoff retries |
| **Events** | RabbitMQ (AMQP) | Event-driven inter-service communication (`order.delivered`) |
| **Health** | @nestjs/terminus | Health checks for Postgres, MongoDB, Redis, Elasticsearch |
| **Rate Limiting** | @nestjs/throttler | Global rate limiting (100 req/min, 60s TTL) |

---

## 🛠 Tech Stack

```mermaid
mindmap
  root((FleetPulse))
    Runtime
      Node.js 20+
      TypeScript 5
      NestJS 11
    Databases
      MongoDB 7 — Orders
      PostgreSQL 16 — Ledger
    Cache & Geo
      Redis 7
        GeoSets
        Distributed Locks
        BullMQ Queues
    Search
      Elasticsearch 9
    Messaging
      RabbitMQ — AMQP
    Real-Time
      Socket.IO — WebSockets
    Auth
      JWT — Passport
      bcrypt — Password Hashing
      RBAC — Role Guards
    DevOps
      Docker — Multi-Stage Build
      Kubernetes — HPA Autoscaling
      GitHub Actions — CI/CD
    Docs
      Swagger/OpenAPI
```

### Dependency Highlights

| Category | Package | Version | Purpose |
|:--|:--|:--|:--|
| **Framework** | `@nestjs/core` | 11.x | Core application framework |
| **Validation** | `class-validator` + `class-transformer` | 0.15 / 0.5 | DTO validation and transformation |
| **Database** | `mongoose` | 9.x | MongoDB ODM for order documents |
| **Database** | `typeorm` + `pg` | 1.x / 8.x | PostgreSQL ORM for ledger entities |
| **Cache** | `redis` | 6.x | Native Redis client for Geo + Locks |
| **Locks** | `redlock` | 5.x-beta | Distributed locking algorithm |
| **Queue** | `bullmq` | 5.x | Redis-backed job queue with retries |
| **Search** | `@elastic/elasticsearch` | 9.x | Elasticsearch client for waybill search |
| **Messaging** | `amqplib` + `amqp-connection-manager` | 2.x / 5.x | RabbitMQ AMQP client |
| **Auth** | `@nestjs/jwt` + `passport-jwt` + `bcrypt` | 11.x / 4.x / 6.x | JWT signing, strategy, password hashing |
| **WebSocket** | `socket.io` + `@nestjs/websockets` | 4.x / 11.x | Real-time bidirectional communication |
| **Health** | `@nestjs/terminus` | 11.x | Health check endpoints |
| **Docs** | `@nestjs/swagger` + `swagger-ui-express` | 11.x / 5.x | Auto-generated API documentation |

---

## 📊 Data Models

### MongoDB — Order Document

```mermaid
erDiagram
    ORDER {
        ObjectId _id PK
        string trackingNumber UK "BSTA-XXXXXXXX-EG"
        string merchantId FK
        string courierId FK "nullable"
        enum status "PENDING | ASSIGNED | IN_TRANSIT | DELIVERED | FAILED"
        Date createdAt
        Date updatedAt
    }
    RECIPIENT {
        string name
        string phone
    }
    ADDRESS {
        string city
        string district
    }
    LOCATION {
        string type "Point"
        number[] coordinates "[lon, lat]"
    }
    PACKAGE_DETAILS {
        number weightKg
        number codAmountValue
        string currency
    }

    ORDER ||--|| RECIPIENT : contains
    RECIPIENT ||--|| ADDRESS : has
    ADDRESS ||--|| LOCATION : has
    ORDER ||--|| PACKAGE_DETAILS : contains
```

<details>
<summary>📄 <b>Example Order Document (MongoDB)</b></summary>

```json
{
  "_id": "667f1a2b3c4d5e6f7a8b9c0d",
  "trackingNumber": "BSTA-A1B2C3D4-EG",
  "merchantId": "merchant_001",
  "courierId": "courier_042",
  "status": "IN_TRANSIT",
  "recipient": {
    "name": "Ahmed Hassan",
    "phone": "+201234567890",
    "address": {
      "city": "Cairo",
      "district": "Nasr City",
      "location": {
        "type": "Point",
        "coordinates": [31.3456, 30.0444]
      }
    }
  },
  "packageDetails": {
    "weightKg": 2.5,
    "codAmountValue": 350.00,
    "currency": "EGP"
  },
  "createdAt": "2026-08-03T08:30:00.000Z",
  "updatedAt": "2026-08-03T09:15:00.000Z"
}
```

</details>

### PostgreSQL — Ledger Schema

```mermaid
erDiagram
    ACCOUNT {
        uuid id PK
        varchar(50) ownerId "Courier / Merchant / PLATFORM"
        enum accountType "COURIER_CASH_HOLDING | MERCHANT_PAYABLE | PLATFORM_REVENUE"
        decimal(12_2) balance "Precision currency"
        timestamp updatedAt
    }
    LEDGER_ENTRY {
        uuid id PK
        uuid transactionId "Groups double-entry records"
        uuid accountId FK
        decimal(12_2) amount "+Credit / -Debit"
        varchar(100) description
        timestamp createdAt
    }

    ACCOUNT ||--o{ LEDGER_ENTRY : "has many"
```

<details>
<summary>📄 <b>Example COD Transaction (PostgreSQL)</b></summary>

When an order with `codAmountValue: 350.00 EGP` is delivered with a `platformFee: 35.00 EGP`:

**Accounts Updated:**
| Account | Owner | Type | Balance Change |
|:--|:--|:--|:--|
| `acc_001` | `courier_042` | `COURIER_CASH_HOLDING` | +350.00 |
| `acc_002` | `merchant_001` | `MERCHANT_PAYABLE` | +315.00 |
| `acc_003` | `PLATFORM` | `PLATFORM_REVENUE` | +35.00 |

**Ledger Entries Created (same `transactionId`):**
| Entry ID | Transaction ID | Account | Amount | Description |
|:--|:--|:--|:--|:--|
| `entry_01` | `txn_abc123` | `acc_001` | 350.00 | COD Collected for Merchant merchant_001 |
| `entry_02` | `txn_abc123` | `acc_002` | 315.00 | Payout for COD delivery |
| `entry_03` | `txn_abc123` | `acc_003` | 35.00 | Platform fee for COD delivery |

</details>

### MongoDB — User Document

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string email UK "lowercase, trimmed"
        string passwordHash "bcrypt, 10 rounds"
        string name
        enum role "ADMIN | MERCHANT | COURIER"
        Date createdAt
        Date updatedAt
    }
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|:--|:--|:--|
| [Node.js](https://nodejs.org/) | 20+ | JavaScript runtime |
| [Docker](https://www.docker.com/) | Latest | Container orchestration |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ | Multi-container management |

### 1. Clone the repository

```bash
git clone https://github.com/mo74x/Fleetpulse.git
cd Fleetpulse
```

### 2. Start infrastructure with Docker Compose

The project includes a `docker-compose.yml` that spins up all 5 infrastructure services:

```bash
docker compose up -d
```

<details>
<summary>🐳 <b>docker-compose.yml contents</b></summary>

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

</details>

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

> **Note**: All environment variables are validated at startup using Joi. The app will fail fast with a descriptive error if any required variable is missing.

### 4. Install dependencies & run

```bash
npm install
npm run start:dev
```

### 5. Access the application

| Service | URL | Description |
|:--|:--|:--|
| 🌐 **HTTP API** | `http://localhost:3000` | REST API base URL |
| 📘 **Swagger UI** | `http://localhost:3000/api/docs` | Interactive API documentation |
| 🏥 **Health Check** | `http://localhost:3000/health` | Infrastructure health status |
| 🐰 **RabbitMQ Dashboard** | `http://localhost:15672` | Message broker management (guest/guest) |

---

## 📘 API Reference

### 🔐 Authentication

All protected routes require a `Bearer` token in the `Authorization` header.

#### `POST /api/v1/auth/register`

Register a new user account.

<details>
<summary><b>Request / Response</b></summary>

**Request Body:**
```json
{
  "email": "ahmed@merchant.com",
  "password": "SecurePass123!",
  "name": "Ahmed Hassan",
  "role": "MERCHANT"
}
```

**Response `201`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "667f1a2b3c4d5e6f7a8b9c0d",
    "email": "ahmed@merchant.com",
    "name": "Ahmed Hassan",
    "role": "MERCHANT",
    "createdAt": "2026-08-03T08:30:00.000Z",
    "updatedAt": "2026-08-03T08:30:00.000Z"
  }
}
```

**Error `409`:**
```json
{
  "statusCode": 409,
  "message": "User with this email already exists",
  "error": "Conflict"
}
```

</details>

#### `POST /api/v1/auth/login`

Authenticate and receive a JWT token.

<details>
<summary><b>Request / Response</b></summary>

**Request Body:**
```json
{
  "email": "ahmed@merchant.com",
  "password": "SecurePass123!"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "667f1a2b3c4d5e6f7a8b9c0d",
    "email": "ahmed@merchant.com",
    "name": "Ahmed Hassan",
    "role": "MERCHANT",
    "createdAt": "2026-08-03T08:30:00.000Z",
    "updatedAt": "2026-08-03T08:30:00.000Z"
  }
}
```

**Error `401`:**
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

</details>

---

### 📦 Orders

#### `POST /api/v1/orders` — Create Order

Accepts an order and enqueues it for async processing via BullMQ.

<details>
<summary><b>Request / Response</b></summary>

**Request Body:**
```json
{
  "merchantId": "merchant_001",
  "recipient": {
    "name": "Ahmed Hassan",
    "phone": "+201234567890",
    "address": {
      "city": "Cairo",
      "district": "Nasr City",
      "location": {
        "type": "Point",
        "coordinates": [31.3456, 30.0444]
      }
    }
  },
  "packageDetails": {
    "weightKg": 2.5,
    "codAmountValue": 350.00,
    "currency": "EGP"
  }
}
```

**Response `202`:**
```json
{
  "message": "Order accepted for processing",
  "trackingNumber": "BSTA-A1B2C3D4-EG"
}
```

</details>

#### `GET /api/v1/orders` — List Orders

Paginated list with optional filters.

| Query Param | Type | Default | Description |
|:--|:--|:--|:--|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `status` | string | — | Filter by status |
| `merchantId` | string | — | Filter by merchant |
| `courierId` | string | — | Filter by courier |

<details>
<summary><b>Response Example</b></summary>

```json
{
  "data": [
    {
      "_id": "667f1a2b3c4d5e6f7a8b9c0d",
      "trackingNumber": "BSTA-A1B2C3D4-EG",
      "merchantId": "merchant_001",
      "status": "PENDING",
      "recipient": { "..." : "..." },
      "packageDetails": { "..." : "..." },
      "createdAt": "2026-08-03T08:30:00.000Z"
    }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

</details>

#### `GET /api/v1/orders/:id` — Get Order

Lookup by MongoDB `ObjectId` or `trackingNumber`.

#### `PATCH /api/v1/orders/:id/status` — Update Status

State-machine validated. Invalid transitions return `400 Bad Request`.

<details>
<summary><b>Request / Response</b></summary>

**Request Body:**
```json
{
  "status": "ASSIGNED",
  "courierId": "courier_042"
}
```

**Error `400` (invalid transition):**
```json
{
  "statusCode": 400,
  "message": "Invalid status transition from DELIVERED to PENDING",
  "error": "Bad Request"
}
```

</details>

---

### 🚚 Dispatch

#### `POST /api/v1/dispatch/assign` — Assign Courier

Auto-assigns nearest courier via Redis GeoSets, or assigns a specific courier. Protected by Redlock distributed locking.

<details>
<summary><b>Request / Response</b></summary>

**Auto-assign (nearest courier):**
```json
{
  "orderId": "667f1a2b3c4d5e6f7a8b9c0d",
  "latitude": 30.0444,
  "longitude": 31.2357,
  "radiusKm": 5
}
```

**Manual assign (specific courier):**
```json
{
  "orderId": "667f1a2b3c4d5e6f7a8b9c0d",
  "courierId": "courier_042"
}
```

**Response `200`:**
```json
{
  "success": true,
  "orderId": "667f1a2b3c4d5e6f7a8b9c0d",
  "courierId": "courier_042",
  "status": "ASSIGNED"
}
```

**Error `409` (race condition):**
```json
{
  "statusCode": 409,
  "message": "Order 667f1a2b... is currently being processed by another worker or courier.",
  "error": "Conflict"
}
```

</details>

---

### 🔍 Search

#### `GET /api/v1/search?q=<term>` — Fuzzy Waybill Search

Searches across `trackingNumber` (3x boosted), `recipientName`, and `city` fields with typo tolerance (`fuzziness: AUTO`).

<details>
<summary><b>Response Example</b></summary>

```json
[
  {
    "trackingNumber": "BSTA-A1B2C3D4-EG",
    "status": "IN_TRANSIT",
    "recipientName": "Ahmed Hassan",
    "city": "Cairo",
    "courierId": "courier_042",
    "createdAt": "2026-08-03T08:30:00.000Z"
  }
]
```

</details>

---

### 📡 WebSocket — Real-Time Telemetry

| Protocol | Namespace | Event | Direction |
|:--|:--|:--|:--|
| Socket.IO | `/telemetry` | `driver_location` | Client → Server |
| Socket.IO | `/telemetry` | `location_ack` | Server → Client |

<details>
<summary><b>WebSocket Payload</b></summary>

**Client Emits `driver_location`:**
```json
{
  "courierId": "courier_042",
  "lon": 31.2357,
  "lat": 30.0444
}
```

**Server Responds `location_ack`:**
```json
{
  "event": "location_ack",
  "status": "updated"
}
```

> The driver's location is stored in a Redis GeoSet (`couriers:locations`) for subsequent geo-spatial dispatch queries.

</details>

---

### 🏥 Health

#### `GET /health` — Infrastructure Health Check

Returns the status of all 4 infrastructure dependencies:

```json
{
  "status": "ok",
  "info": {
    "postgres": { "status": "up" },
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "elasticsearch": { "status": "up" }
  },
  "details": {
    "postgres": { "status": "up" },
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "elasticsearch": { "status": "up" }
  }
}
```

---

## 🔄 Order Lifecycle

### State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING : Order Created

    PENDING --> ASSIGNED : Courier dispatched
    PENDING --> FAILED : Processing error

    ASSIGNED --> IN_TRANSIT : Courier picks up package
    ASSIGNED --> FAILED : Courier unavailable

    IN_TRANSIT --> DELIVERED : Package delivered ✅
    IN_TRANSIT --> FAILED : Delivery failed

    DELIVERED --> [*]
    FAILED --> [*]

    note right of DELIVERED
        Triggers RabbitMQ event
        → order.delivered
        → COD Ledger Settlement
    end note
```

### Transition Rules

| Current State | Allowed Transitions | Denied Transitions |
|:--|:--|:--|
| `PENDING` | `ASSIGNED`, `FAILED` | `IN_TRANSIT`, `DELIVERED` |
| `ASSIGNED` | `IN_TRANSIT`, `FAILED` | `PENDING`, `DELIVERED` |
| `IN_TRANSIT` | `DELIVERED`, `FAILED` | `PENDING`, `ASSIGNED` |
| `DELIVERED` | *(terminal)* | All |
| `FAILED` | *(terminal)* | All |

> Invalid transitions return `400 Bad Request` with a descriptive error message.

---

## 🧪 Testing

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Debug tests
npm run test:debug
```

### Test Coverage Summary

| Service | Tests | What's Covered |
|:--|:--|:--|
| **OrdersService** | 10 | Order creation, queue enqueue, pagination with filters, findOne by ID/tracking, status transitions, invalid transition rejection |
| **LedgerService** | 5 | COD payment processing, pessimistic locking, double-entry ledger entries, atomic rollback on failure, account validation |
| **SearchService** | 7 | Index initialization, document indexing/updating, fuzzy search across fields, error resilience, ES client configuration |

### Testing Strategy

```mermaid
graph LR
    A[Unit Tests] --> B[Service Layer]
    A --> C[DTOs & Validation]
    A --> D[State Machine Logic]
    
    E[Integration Tests] --> F[API Endpoints]
    E --> G[Database Operations]
    
    H[E2E Tests] --> I[Full Request Flows]
    H --> J[WebSocket Connections]
    
    style A fill:#22c55e,stroke:#16a34a,color:#fff
    style E fill:#3b82f6,stroke:#2563eb,color:#fff
    style H fill:#a855f7,stroke:#9333ea,color:#fff
```

---

## 🚢 CI/CD & Deployment

### CI Pipeline

The project includes two GitHub Actions workflows:

```mermaid
graph LR
    subgraph "CI Pipeline (ci.yml)"
        A[Push / PR to main] --> B[Checkout]
        B --> C[Setup Node.js 20]
        C --> D[npm ci]
        D --> E[ESLint]
        E --> F[TypeScript Build]
        F --> G[Jest Tests + Coverage]
    end

    subgraph "CD Pipeline (ci-cd.yml)"
        H[Push to main] --> I[Lint + Test + Build]
        I --> J[Docker Buildx]
        J --> K[Login to DockerHub]
        K --> L["Push Image<br/>:latest + :sha"]
    end

    style A fill:#22c55e,stroke:#16a34a,color:#fff
    style H fill:#3b82f6,stroke:#2563eb,color:#fff
```

### Docker — Multi-Stage Build

The Dockerfile uses a 3-stage build for minimal production images:

```
Stage 1: Builder    → Full install + TypeScript compilation
Stage 2: Deps       → Production-only dependencies (npm ci --omit=dev)
Stage 3: Production → Alpine image + compiled JS + prod deps only
```

```bash
# Build the image
docker build -t fleetpulse:latest .

# Run the container
docker run -p 3000:3000 --env-file .env fleetpulse:latest
```

> The production image runs as a non-root `node` user for security.

### Kubernetes — Production Deployment

The `k8s/` directory contains production-ready manifests:

| File | Resource | Configuration |
|:--|:--|:--|
| `fleetpulse-deployment.yaml` | Deployment | 3 replicas, resource limits (256Mi–512Mi RAM, 250m–500m CPU) |
| `fleetpulse-deployment.yaml` | Service | ClusterIP on port 80 → 3000 |
| `fleetpulse-hpa.yaml` | HorizontalPodAutoscaler | Scale 3–10 pods at 70% CPU utilization |

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        HPA[HPA<br/>3-10 pods<br/>70% CPU target]
        
        subgraph "Deployment (fleetpulse-api)"
            P1[Pod 1<br/>256Mi / 250m]
            P2[Pod 2<br/>256Mi / 250m]
            P3[Pod 3<br/>256Mi / 250m]
        end
        
        SVC[ClusterIP Service<br/>:80 → :3000]
        
        HPA --> P1
        HPA --> P2
        HPA --> P3
        SVC --> P1
        SVC --> P2
        SVC --> P3
    end

    LB[Load Balancer / Ingress] --> SVC

    style HPA fill:#326CE5,stroke:#fff,color:#fff
    style SVC fill:#326CE5,stroke:#fff,color:#fff
    style LB fill:#FF6600,stroke:#fff,color:#fff
```

Features:
- **Readiness Probes**: Traffic is only routed to fully booted pods (`/api/v1/health`)
- **Secrets Management**: Sensitive env vars reference `fleetpulse-secrets` Kubernetes Secret
- **Resource Limits**: Prevents a single pod from crashing the cluster

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check pod status
kubectl get pods -l app=fleetpulse

# View HPA scaling
kubectl get hpa fleetpulse-api-hpa
```

---

## 📁 Project Structure

```
fleetpulse/
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Lint → Build → Test
│       └── ci-cd.yml                     # Full CI/CD + Docker push
├── k8s/
│   ├── fleetpulse-deployment.yaml        # Deployment + Service (3 replicas)
│   └── fleetpulse-hpa.yaml              # Horizontal Pod Autoscaler (3-10 pods)
├── src/
│   ├── auth/                             # 🔐 JWT Authentication & RBAC
│   │   ├── auth.controller.ts            #    POST /register, /login
│   │   ├── auth.service.ts               #    bcrypt hashing, JWT signing
│   │   ├── jwt.strategy.ts               #    Passport JWT strategy
│   │   ├── roles.guard.ts                #    Role-based access guard
│   │   ├── user-role.enum.ts             #    ADMIN | MERCHANT | COURIER
│   │   ├── user.schema.ts                #    MongoDB User document
│   │   ├── register.dto.ts               #    Registration validation
│   │   └── login.dto.ts                  #    Login validation
│   ├── dispatch/                         # 🚚 Courier Assignment & Tracking
│   │   ├── dispatch/
│   │   │   ├── dispatch.controller.ts    #    POST /dispatch/assign
│   │   │   └── dispatch.service.ts       #    Geo-search + Redlock assignment
│   │   ├── redis/
│   │   │   └── redis.service.ts          #    Raw Redis client + GeoSets + Redlock
│   │   └── tracking/
│   │       └── tracking.gateway.ts       #    Socket.IO WebSocket gateway
│   ├── health/                           # 🏥 Infrastructure Health Checks
│   │   ├── health.controller.ts          #    GET /health (Postgres, Mongo, Redis, ES)
│   │   └── health.module.ts              #    Health indicators registration
│   ├── ledger/                           # 💰 Financial Double-Entry Ledger
│   │   ├── entities/
│   │   │   ├── account.entity.ts         #    Account types + decimal balance
│   │   │   └── ledger-entry.entity.ts    #    Immutable transaction records
│   │   ├── ledger.controller.ts          #    RabbitMQ event consumer
│   │   └── ledger.service.ts             #    COD settlement with pessimistic locks
│   ├── orders/                           # 📦 Order CRUD & Lifecycle
│   │   ├── dto/
│   │   │   ├── create-order.dto.ts       #    Nested DTO with class-validator
│   │   │   ├── order-query.dto.ts        #    Pagination + filter params
│   │   │   └── update-order-status.dto.ts #   Status enum + courierId
│   │   ├── schemas/
│   │   │   └── order.schema.ts           #    MongoDB schema (GeoJSON + nested)
│   │   ├── orders.controller.ts          #    REST endpoints
│   │   └── orders.service.ts             #    BullMQ enqueue + state machine
│   ├── search/                           # 🔍 Elasticsearch Waybill Search
│   │   ├── search.controller.ts          #    GET /search?q=
│   │   └── search.service.ts             #    Index init + fuzzy multi_match
│   ├── app.module.ts                     #    Root module (Joi config validation)
│   └── main.ts                           #    Bootstrap + Swagger + RabbitMQ consumer
├── Dockerfile                            #    Multi-stage production build
├── docker-compose.yml                    #    5-service development stack
├── package.json                          #    Dependencies & scripts
└── tsconfig.json                         #    TypeScript configuration
```

---

## 📜 Available Scripts

| Script | Command | Description |
|:--|:--|:--|
| **Dev** | `npm run start:dev` | Start with hot-reload (watch mode) |
| **Debug** | `npm run start:debug` | Start with Node.js debugger attached |
| **Prod** | `npm run start:prod` | Run compiled JS from `dist/` |
| **Build** | `npm run build` | Compile TypeScript via `nest build` |
| **Lint** | `npm run lint` | ESLint with auto-fix |
| **Format** | `npm run format` | Prettier formatting |
| **Test** | `npm test` | Run Jest unit tests |
| **Test Watch** | `npm run test:watch` | Jest in watch mode |
| **Test Coverage** | `npm run test:cov` | Generate coverage report |
| **Test E2E** | `npm run test:e2e` | Run end-to-end tests |

---

## 🔒 Environment Variables

All variables are validated at startup with **Joi**. The application will refuse to start if required variables are missing.

| Variable | Required | Default | Description |
|:--|:--|:--|:--|
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | Environment (`development`, `production`, `test`) |
| `MONGO_URI` | **Yes** | — | MongoDB connection string |
| `POSTGRES_HOST` | **Yes** | — | PostgreSQL hostname |
| `POSTGRES_PORT` | No | `5432` | PostgreSQL port |
| `POSTGRES_USER` | **Yes** | — | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes** | — | PostgreSQL password |
| `POSTGRES_DB` | **Yes** | — | PostgreSQL database name |
| `REDIS_HOST` | **Yes** | — | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `RABBITMQ_URI` | **Yes** | — | RabbitMQ AMQP connection URI |
| `ELASTICSEARCH_NODE` | **Yes** | — | Elasticsearch node URL |
| `JWT_SECRET` | **Yes** | — | Secret key for JWT signing |
| `JWT_EXPIRATION` | No | `1d` | JWT token expiration duration |

---

## 📄 License

This project is [MIT licensed](LICENSE).
