<p align="center">
  <img src="assets/fleetpulse-banner.png" width="800" alt="FleetPulse Banner" />
</p>

<h1 align="center">FleetPulse</h1>
<p align="center">
  <b>Production-Grade Last-Mile Delivery Engine — Event-Driven, Distributed, Observable</b>
</p>
<p align="center">
  <i>A backend platform that handles the entire lifecycle of a delivery order — from merchant ingestion to courier dispatch, real-time GPS tracking, proof of delivery, financial settlement, and operational observability.</i>
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
  <img src="https://img.shields.io/badge/OpenTelemetry-Traced-4B0082?style=for-the-badge&logo=opentelemetry&logoColor=white" alt="OpenTelemetry" />
  <img src="https://img.shields.io/badge/Prometheus-Metrics-E6522C?style=for-the-badge&logo=prometheus&logoColor=white" alt="Prometheus" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <a href="#-the-business-problem">Problem</a> •
  <a href="#-what-fleetpulse-does">Solution</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-engineering-highlights">Engineering</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Setup</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-observability">Observability</a> •
  <a href="#-testing">Testing</a> •
  <a href="#-cicd--deployment">Deploy</a>
</p>

---

## 🎯 The Business Problem

In Egypt and the MENA region, last-mile delivery platforms process **thousands of cash-on-delivery orders daily**. The operational challenges are immense:

- **Merchants** need to ingest bulk orders and track them in real-time
- **Dispatchers** need to assign the nearest available courier instantly — without two dispatchers assigning the same courier
- **Couriers** need to upload proof of delivery (photos + signatures) from the field
- **Finance teams** need accurate, auditable COD settlement — every pound collected must be traced through a double-entry ledger
- **Operations teams** need to know when queues are backing up, which endpoints are slow, and trace a single request across HTTP → Queue → Worker → Database → Message Bus

**FleetPulse** is the backend engine that solves all of this.

---

## 🚀 What FleetPulse Does

| Capability | How It Works |
|:--|:--|
| 📦 **Order Ingestion** | Merchants submit orders via REST API → instantly accepted (202) → processed asynchronously through BullMQ with 3x exponential backoff retries |
| 📍 **Smart Dispatch** | Geo-spatial courier assignment using Redis GeoSets — find the nearest available driver within a configurable radius. Protected by Redlock distributed locks to prevent double-dispatch |
| 📡 **Live GPS Tracking** | Socket.IO WebSocket gateway ingests real-time driver telemetry, stored in Redis GeoSets for continuous proximity queries |
| 📸 **Proof of Delivery** | Package photo + recipient signature (file upload or base64 canvas) uploaded to S3 → order auto-transitions to `DELIVERED` |
| 💰 **COD Settlement** | When an order is delivered, a RabbitMQ event triggers a PostgreSQL double-entry ledger transaction with pessimistic locking — courier, merchant, and platform accounts are updated atomically |
| 🔍 **Waybill Search** | Elasticsearch fuzzy search across tracking numbers (3x boosted), recipient names, and cities with typo tolerance |
| 📊 **Analytics Engine** | Aggregated operational analytics — delivery performance, revenue breakdown, courier utilization, SLA adherence — powered by MongoDB aggregation pipelines |
| 🔔 **Multi-Channel Notifications** | Order status changes trigger Email, SMS, Push, and In-App notifications via BullMQ workers with per-channel provider abstraction |
| 🌐 **Merchant Webhooks** | Configurable webhook subscriptions per merchant — signed payloads (HMAC-SHA256), automatic retries with exponential backoff, delivery logging |
| 🗺️ **Route Optimization** | Haversine-based multi-stop route optimization with ETA calculations for courier route planning |
| 📈 **Prometheus Metrics** | Business metrics (`orders_created_total`, `dispatch_duration_seconds`, `queue_depth`) + HTTP metrics (`request duration`, `error rates by endpoint`) exposed at `/metrics` |
| 🔭 **Distributed Tracing** | OpenTelemetry SDK with Jaeger/Zipkin exporters — trace a single request across HTTP → BullMQ Queue → Worker → Database → RabbitMQ with W3C context propagation |
| 💀 **Dead Letter Queue** | Failed jobs that exhaust all retries are captured in a DLQ with full failure metadata — inspect, replay, or purge via REST API |
| 🔐 **Authentication** | JWT access tokens (15m) + rotatable refresh tokens (7d) + logout revocation + role-based access control (Admin, Merchant, Courier) |
| 🏥 **Health Checks** | Terminus-based health probes for all 5 infrastructure dependencies — Kubernetes readiness-compatible |

---

## 🏗 Architecture

### High-Level System Diagram

```mermaid
graph TB
    subgraph Clients
        A["🖥️ Merchant Dashboard"]
        B["📱 Driver Mobile App"]
    end

    subgraph Gateway ["NestJS API Gateway"]
        C["🔐 Auth Module<br/>JWT + RBAC"]
        D["📦 Orders Module<br/>Ingestion + Lifecycle"]
        E["🚚 Dispatch Module<br/>Geo + Locking"]
        F["🔍 Search Module<br/>Elasticsearch"]
        G["💰 Ledger Module<br/>Double-Entry"]
        H["🏥 Health Module<br/>Terminus"]
        I["📈 Metrics Module<br/>Prometheus"]
        J["🔭 Tracing Module<br/>OpenTelemetry"]
        K["📊 Analytics Module<br/>Aggregation"]
        L["🔔 Notifications Module<br/>Multi-Channel"]
        M["🌐 Webhooks Module<br/>Signed Delivery"]
        N["🗺️ Routing Module<br/>ETA + Optimization"]
        O["💀 DLQ Module<br/>Failed Job Recovery"]
    end

    subgraph Data ["Data & Messaging Layer"]
        P[("MongoDB<br/>Orders + Users")]
        Q[("PostgreSQL<br/>Ledger + Accounts")]
        R[("Redis<br/>Geo + Locks + BullMQ")]
        S["Elasticsearch<br/>Waybill Index"]
        T["RabbitMQ<br/>Event Bus"]
    end

    subgraph Observability
        U["Prometheus<br/>/metrics"]
        V["Jaeger / Zipkin<br/>Trace Collector"]
    end

    A -- HTTP/REST --> C
    A -- HTTP/REST --> D
    A -- HTTP/REST --> F
    A -- HTTP/REST --> K
    B -- WebSocket --> E
    B -- HTTP/REST --> D

    D --> P
    D --> R
    G --> Q
    E --> R
    F --> S
    K --> P
    L --> R
    M --> R
    O --> R
    D -- order.delivered --> T
    T -- consume --> G
    T -- consume --> L

    I --> U
    J --> V

    style Gateway fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#fff
    style Data fill:#0f3460,stroke:#16213e,stroke-width:2px,color:#fff
    style Clients fill:#16213e,stroke:#0f3460,stroke-width:2px,color:#fff
    style Observability fill:#2d1b69,stroke:#7c3aed,stroke-width:2px,color:#fff
```

### Request Flow — Order Creation to COD Settlement

```mermaid
sequenceDiagram
    participant Client
    participant API as NestJS Gateway
    participant Queue as BullMQ (Redis)
    participant Worker as Queue Worker
    participant DB as MongoDB
    participant ES as Elasticsearch
    participant MQ as RabbitMQ
    participant Ledger as PostgreSQL

    Client->>API: POST /api/v1/orders
    API->>API: Validate DTO (class-validator)
    API->>API: Generate Tracking Number (BSTA-XXXXXXXX-EG)
    API->>API: Inject OTel trace context into job payload
    API->>Queue: Enqueue job (3 retries, exponential backoff)
    API-->>Client: 202 { trackingNumber, message }

    Queue->>Worker: Process job (within traced span)
    Worker->>DB: Insert Order document
    Worker->>ES: Index waybill document
    Worker->>MQ: Emit order.created event
    Worker-->>Queue: Job complete

    Note over DB,Ledger: When status → DELIVERED
    MQ->>API: Consume order.delivered event
    API->>Ledger: BEGIN TRANSACTION (pessimistic locks)
    Ledger->>Ledger: Update Courier + Merchant + Platform accounts
    Ledger->>Ledger: Insert double-entry ledger records
    Ledger->>Ledger: COMMIT

    Note over Queue: If job fails 3x → Dead Letter Queue
```

### Courier Dispatch with Geo-Spatial Search

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

### COD Financial Settlement (Double-Entry Ledger)

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

---

## ⚙️ Engineering Highlights

### Why This Project Demonstrates Production-Level Engineering

| Concern | How FleetPulse Addresses It |
|:--|:--|
| **Polyglot Persistence** | MongoDB for flexible order documents, PostgreSQL for ACID-compliant financial ledger, Redis for geo-spatial data + caching + job queues, Elasticsearch for full-text search |
| **Event-Driven Architecture** | RabbitMQ decouples order lifecycle from financial settlement — producers don't wait for consumers |
| **Async Job Processing** | BullMQ with exponential backoff retries, configurable attempts, and automatic Dead Letter Queue capture on exhaustion |
| **Distributed Concurrency** | Redlock algorithm prevents double-dispatch — if two dispatchers try to assign the same courier simultaneously, one gets a 409 Conflict |
| **Financial Integrity** | PostgreSQL pessimistic locking (`SELECT ... FOR UPDATE`) ensures COD amounts are never double-credited, even under concurrent load |
| **State Machine Enforcement** | Order status transitions are validated server-side — `DELIVERED → PENDING` is impossible, preventing data corruption |
| **Distributed Tracing** | OpenTelemetry with W3C context propagation traces a request from HTTP handler → BullMQ job → Worker processing → Database writes → RabbitMQ emission |
| **Business Metrics** | Prometheus counters/histograms track orders-per-minute, dispatch latency, queue depth, processing duration, and HTTP error rates by endpoint |
| **Structured Logging** | Pino logger with correlation IDs — every log line from a single request shares the same `X-Request-ID`, even across async boundaries |
| **Webhook Reliability** | HMAC-SHA256 signed payloads, configurable retry with exponential backoff, delivery audit trail in MongoDB |
| **Graceful Failure** | Dead Letter Queue captures permanently failed jobs with full metadata (original payload, error stack, queue name, attempt count) for manual inspection and replay |
| **Container-Native** | Multi-stage Docker builds, Kubernetes Deployments with HPA (3-10 pods, 70% CPU target), readiness probes, secrets management |
| **API Standards** | Swagger/OpenAPI documentation, URI versioning (`/api/v1/`), class-validator DTOs, consistent error response format |

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
      MongoDB 7 — Orders & Users
      PostgreSQL 16 — Financial Ledger
    Cache & Geo
      Redis 7
        GeoSets — Courier Proximity
        Distributed Locks — Redlock
        BullMQ — Job Queues
    Search
      Elasticsearch 9 — Fuzzy Waybill
    Messaging
      RabbitMQ — Event Bus (AMQP)
    Real-Time
      Socket.IO — WebSocket Telemetry
    Auth
      JWT — Access & Refresh Tokens
      bcrypt — Password Hashing
      RBAC — Role-Based Guards
    Storage
      AWS S3 — POD File Uploads
    Observability
      Prometheus — Business & HTTP Metrics
      OpenTelemetry — Distributed Tracing
      Jaeger / Zipkin — Trace Collection
      Pino — Structured Logging
    Notifications
      Email — SMTP / SendGrid
      SMS — Twilio
      Push — FCM
      In-App — Socket.IO
    DevOps
      Docker — Multi-Stage Build
      Kubernetes — HPA Autoscaling
      GitHub Actions — CI/CD
    Docs
      Swagger / OpenAPI
```

### System Components

| Component | Technology | Purpose |
|:--|:--|:--|
| **API Gateway** | NestJS + Express | REST API with Swagger/OpenAPI documentation |
| **Auth** | Passport + JWT + bcrypt | Short-lived access (15m), rotatable refresh tokens (7d), RBAC, logout revocation |
| **Orders** | MongoDB + Mongoose | Order ingestion, CRUD, status lifecycle with state machine validation |
| **Dispatch** | Redis GeoSets + Redlock | Geo-spatial courier lookup and concurrency-safe assignment |
| **Tracking** | Socket.IO (WebSocket) | Real-time driver GPS telemetry via `/telemetry` namespace |
| **Search** | Elasticsearch 9 | Fuzzy waybill search (tracking numbers, names, cities) |
| **Ledger** | PostgreSQL + TypeORM | Double-entry bookkeeping for COD settlement with pessimistic locking |
| **Notifications** | BullMQ + Providers | Multi-channel (Email, SMS, Push, In-App) with per-channel provider abstraction |
| **Webhooks** | BullMQ + HMAC-SHA256 | Merchant webhook subscriptions with signed payloads and retry |
| **Analytics** | MongoDB Aggregation | Delivery performance, revenue, courier stats, SLA metrics |
| **Routing** | Haversine Algorithm | Multi-stop route optimization and ETA calculation |
| **Metrics** | Prometheus + prom-client | Business metrics, queue depth, HTTP latency/error rates |
| **Tracing** | OpenTelemetry SDK | Distributed tracing across HTTP, queues, workers, databases, message bus |
| **DLQ** | BullMQ | Dead letter capture, inspection, manual replay, and purging |
| **Queue** | BullMQ (Redis) | Async processing with 3x exponential backoff retries |
| **Events** | RabbitMQ (AMQP) | Event-driven inter-service communication |
| **Health** | @nestjs/terminus | Readiness probes for all infrastructure dependencies |
| **Rate Limiting** | @nestjs/throttler | Global rate limiting (100 req/min) |

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
    PROOF_OF_DELIVERY {
        string photoUrl "S3 URL"
        string signatureUrl "S3 URL"
        object location "GeoJSON Point"
        Date timestamp
        string courierId
        string notes
    }

    ORDER ||--|| RECIPIENT : contains
    RECIPIENT ||--|| ADDRESS : has
    ADDRESS ||--|| LOCATION : has
    ORDER ||--|| PACKAGE_DETAILS : contains
    ORDER ||--o| PROOF_OF_DELIVERY : "has (on delivery)"
```

<details>
<summary>📄 <b>Example Order Document (MongoDB)</b></summary>

```json
{
  "_id": "667f1a2b3c4d5e6f7a8b9c0d",
  "trackingNumber": "BSTA-A1B2C3D4-EG",
  "merchantId": "merchant_001",
  "courierId": "courier_042",
  "status": "DELIVERED",
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
  "proofOfDelivery": {
    "photoUrl": "https://s3.amazonaws.com/fleetpulse-pod/packages/photo.png",
    "signatureUrl": "https://s3.amazonaws.com/fleetpulse-pod/signatures/sig.png",
    "location": { "type": "Point", "coordinates": [31.2357, 30.0444] },
    "timestamp": "2026-08-04T12:30:00.000Z",
    "courierId": "courier_042",
    "notes": "Left at doorstep"
  },
  "createdAt": "2026-08-03T08:30:00.000Z",
  "updatedAt": "2026-08-04T12:30:00.000Z"
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

    IN_TRANSIT --> DELIVERED : POD uploaded ✅
    IN_TRANSIT --> FAILED : Delivery failed

    DELIVERED --> [*]
    FAILED --> [*]

    note right of DELIVERED
        Triggers:
        → RabbitMQ event (order.delivered)
        → COD Ledger Settlement
        → Merchant Webhook notification
        → Multi-channel notification
    end note

    note right of FAILED
        After 3 retries:
        → Captured in Dead Letter Queue
        → Available for manual replay
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

## 📈 Observability

### Prometheus Metrics (`GET /metrics`)

| Metric | Type | Labels | Description |
|:--|:--|:--|:--|
| `orders_created_total` | Counter | — | Total orders created (use `rate()` for orders/minute) |
| `dispatch_duration_seconds` | Histogram | — | Time to assign courier to order |
| `queue_depth` | Gauge | `queue`, `status` | Current job count per BullMQ queue |
| `queue_job_duration_seconds` | Histogram | `queue`, `status` | Processing time per queue worker |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | HTTP request count by endpoint |
| `http_errors_total` | Counter | `method`, `route`, `status_code` | HTTP error count (4xx/5xx) |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | HTTP request latency |

### Distributed Tracing (OpenTelemetry)

Traces are propagated using **W3C `traceparent`** context across:

```
HTTP Request → BullMQ Job Payload → Worker Span → Database Operations → RabbitMQ Event Emission
```

| Configuration | Env Variable | Default |
|:--|:--|:--|
| Exporter type | `OTEL_EXPORTER_TYPE` | `jaeger` |
| Jaeger endpoint | `OTEL_EXPORTER_JAEGER_ENDPOINT` | `http://localhost:14268/api/traces` |
| Zipkin endpoint | `OTEL_EXPORTER_ZIPKIN_ENDPOINT` | `http://localhost:9411/api/v2/spans` |
| OTLP endpoint | `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` |
| Service name | `OTEL_SERVICE_NAME` | `fleetpulse-service` |

### Dead Letter Queue (`/api/v1/dlq`)

When a BullMQ job exhausts all 3 retries, it's automatically captured in the Dead Letter Queue with:

- Original queue name and job ID
- Full original payload
- Failure reason and stack trace
- Timestamp and attempt count

**Management endpoints:**

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/api/v1/dlq` | List failed jobs (paginated, filterable by queue) |
| `GET` | `/api/v1/dlq/:id` | Get detailed failure info for a specific job |
| `POST` | `/api/v1/dlq/:id/retry` | Re-queue job back to its original queue |
| `DELETE` | `/api/v1/dlq/:id` | Remove a single dead letter job |
| `DELETE` | `/api/v1/dlq` | Purge all dead letter jobs |

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

```bash
docker compose up -d
```

This spins up **MongoDB**, **PostgreSQL**, **Redis**, **RabbitMQ**, and **Elasticsearch**.

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
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRATION=7d

# S3 Storage (POD uploads)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=fleetpulse-pod
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# OpenTelemetry (optional)
OTEL_EXPORTER_TYPE=jaeger
OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_SERVICE_NAME=fleetpulse-service
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
| 📈 **Prometheus Metrics** | `http://localhost:3000/metrics` | Prometheus scrape endpoint |
| 🐰 **RabbitMQ Dashboard** | `http://localhost:15672` | Message broker management (guest/guest) |

---

## 📘 API Reference

### 🔐 Authentication

All protected routes require a `Bearer` token in the `Authorization` header. Access tokens expire after **15 minutes**; use the refresh endpoint to obtain new tokens without re-authenticating.

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/api/v1/auth/register` | Register a new user (returns access + refresh tokens) |
| `POST` | `/api/v1/auth/login` | Authenticate and receive tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate tokens using a valid refresh token |
| `POST` | `/api/v1/auth/logout` 🔒 | Revoke the current refresh token |

### 📦 Orders

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/api/v1/orders` | Create order (async, returns 202 with tracking number) |
| `GET` | `/api/v1/orders` | List orders (paginated, filterable by status/merchant/courier) |
| `GET` | `/api/v1/orders/:id` | Get order by ID or tracking number |
| `PATCH` | `/api/v1/orders/:id/status` | Update order status (state-machine validated) |
| `POST` | `/api/v1/orders/:id/pod` 🔒 | Upload proof of delivery (photo + signature) |

### 🚚 Dispatch

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/api/v1/dispatch/assign` | Auto-assign nearest courier or assign specific courier |
| `GET` | `/api/v1/couriers/:id` | Get courier profile and status |
| `PATCH` | `/api/v1/couriers/:id/availability` | Toggle courier availability |

### 🔍 Search

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/api/v1/search?q=<term>` | Fuzzy waybill search (tracking, name, city) |

### 📊 Analytics

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/api/v1/analytics/delivery-performance` | Delivery success rate, avg time, status breakdown |
| `GET` | `/api/v1/analytics/revenue` | Revenue summary, top merchants, COD distribution |
| `GET` | `/api/v1/analytics/courier-performance` | Courier rankings, delivery count, avg delivery time |
| `GET` | `/api/v1/analytics/sla` | SLA adherence metrics and compliance rates |

### 🌐 Webhooks

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/api/v1/webhooks/subscriptions` | Create webhook subscription for a merchant |
| `GET` | `/api/v1/webhooks/subscriptions` | List merchant webhook subscriptions |
| `DELETE` | `/api/v1/webhooks/subscriptions/:id` | Remove a webhook subscription |
| `GET` | `/api/v1/webhooks/deliveries` | View webhook delivery log |

### 🗺️ Routing

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/api/v1/routing/eta` | Calculate ETA between two points |
| `POST` | `/api/v1/routing/optimize` | Optimize multi-stop delivery route |
| `POST` | `/api/v1/routing/batch-eta` | Calculate ETAs for multiple orders |

### 💀 Dead Letter Queue

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/api/v1/dlq` | List failed jobs (paginated, filterable by queue) |
| `GET` | `/api/v1/dlq/:id` | Get failure details for a dead letter job |
| `POST` | `/api/v1/dlq/:id/retry` | Re-queue job back to original queue |
| `DELETE` | `/api/v1/dlq/:id` | Remove a single dead letter job |
| `DELETE` | `/api/v1/dlq` | Purge all dead letter jobs |

### 📡 WebSocket — Real-Time Telemetry

| Protocol | Namespace | Event | Direction |
|:--|:--|:--|:--|
| Socket.IO | `/telemetry` | `driver_location` | Client → Server |
| Socket.IO | `/telemetry` | `location_ack` | Server → Client |

### 🏥 Health

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/health` | Infrastructure health status (Postgres, Mongo, Redis, ES) |
| `GET` | `/metrics` | Prometheus metrics scrape endpoint |

---

## 🧪 Testing

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

### Test Coverage

| Module | Tests | What's Covered |
|:--|:--|:--|
| **AuthService** | 10 | Registration, login, token rotation, expired/invalid token rejection, logout revocation |
| **AuthController** | 6 | Register, login, refresh, and logout endpoint routing |
| **OrdersService** | 17 | Order creation, queue enqueue, pagination with filters, findOne, status transitions, POD upload |
| **LedgerService** | 5 | COD processing, pessimistic locking, double-entry entries, atomic rollback, account validation |
| **SearchService** | 7 | Index initialization, document indexing, fuzzy search, error resilience |
| **DispatchService** | 4 | Geo-search, courier assignment, Redlock concurrency, conflict handling |
| **CourierService** | 6 | Courier CRUD, availability toggle, active order tracking |
| **AnalyticsService** | 5 | Delivery performance, revenue, courier stats, SLA aggregations |
| **WebhooksService** | 6 | Subscription CRUD, webhook delivery, HMAC signing, delivery logging |
| **NotificationsProcessor** | 4 | Email, SMS, Push, In-App channel dispatch |
| **MetricsInterceptor** | 3 | HTTP request/error counting, duration observation |
| **QueueMetricsService** | 1 | Queue depth collection across all BullMQ queues |
| **TracingService** | 4 | Tracer creation, context injection/extraction, active span lifecycle |
| **DlqService** | 7 | Job capture, pagination, filtering, replay, removal, purging |
| **DlqController** | 5 | All REST endpoints for DLQ management |
| **RoutingEngine** | 3 | Haversine distance, multi-stop optimization, edge cases |
| **EtaService** | 3 | ETA calculation, speed configuration, batch processing |

### Testing Strategy

```mermaid
graph LR
    A[Unit Tests] --> B[Service Layer]
    A --> C[DTOs & Validation]
    A --> D[State Machine Logic]
    A --> E[Metrics & Tracing]
    A --> F[DLQ Capture & Replay]
    
    G[Integration Tests] --> H[API Endpoints]
    G --> I[Database Operations]
    
    J[E2E Tests] --> K[Full Request Flows]
    J --> L[WebSocket Connections]
    
    style A fill:#22c55e,stroke:#16a34a,color:#fff
    style G fill:#3b82f6,stroke:#2563eb,color:#fff
    style J fill:#a855f7,stroke:#9333ea,color:#fff
```

---

## 🚢 CI/CD & Deployment

### CI/CD Pipeline

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

```
Stage 1: Builder    → Full install + TypeScript compilation
Stage 2: Deps       → Production-only dependencies (npm ci --omit=dev)
Stage 3: Production → Alpine image + compiled JS + prod deps only
```

```bash
docker build -t fleetpulse:latest .
docker run -p 3000:3000 --env-file .env fleetpulse:latest
```

> Production image runs as a non-root `node` user for security.

### Kubernetes — Production Deployment

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

```bash
kubectl apply -f k8s/
kubectl get pods -l app=fleetpulse
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
│   └── fleetpulse-hpa.yaml              # Horizontal Pod Autoscaler
├── src/
│   ├── auth/                             # 🔐 JWT Authentication & RBAC
│   │   ├── auth.controller.ts            #    POST /register, /login, /refresh, /logout
│   │   ├── auth.service.ts               #    Token generation, rotation, revocation
│   │   ├── jwt.strategy.ts               #    Passport JWT strategy
│   │   ├── roles.guard.ts                #    Role-based access guard
│   │   └── user.schema.ts                #    MongoDB User document
│   ├── orders/                           # 📦 Order CRUD & Lifecycle
│   │   ├── orders.controller.ts          #    REST endpoints + POD upload
│   │   ├── orders.service.ts             #    BullMQ enqueue + state machine
│   │   └── orders.processor.ts           #    Queue worker + DLQ + tracing
│   ├── dispatch/                         # 🚚 Courier Assignment & Tracking
│   │   ├── dispatch/
│   │   │   ├── dispatch.controller.ts    #    POST /dispatch/assign
│   │   │   └── dispatch.service.ts       #    Geo-search + Redlock
│   │   ├── redis/
│   │   │   └── redis.service.ts          #    Redis client + GeoSets + Redlock
│   │   └── tracking/
│   │       └── tracking.gateway.ts       #    Socket.IO WebSocket gateway
│   ├── search/                           # 🔍 Elasticsearch Waybill Search
│   │   ├── search.controller.ts          #    GET /search?q=
│   │   └── search.service.ts             #    Index init + fuzzy multi_match
│   ├── ledger/                           # 💰 Financial Double-Entry Ledger
│   │   ├── entities/
│   │   │   ├── account.entity.ts         #    Account types + decimal balance
│   │   │   └── ledger-entry.entity.ts    #    Immutable transaction records
│   │   ├── ledger.controller.ts          #    RabbitMQ event consumer
│   │   └── ledger.service.ts             #    COD settlement + pessimistic locks
│   ├── notifications/                    # 🔔 Multi-Channel Notifications
│   │   ├── notifications.service.ts      #    Notification dispatcher
│   │   ├── notifications.processor.ts    #    Email, SMS, Push, In-App workers
│   │   ├── notifications.gateway.ts      #    WebSocket gateway (in-app)
│   │   └── providers/                    #    Channel-specific providers
│   ├── webhooks/                         # 🌐 Merchant Webhook Delivery
│   │   ├── webhooks.controller.ts        #    Subscription CRUD + delivery log
│   │   ├── webhooks.service.ts           #    Subscription management + enqueue
│   │   ├── webhooks.processor.ts         #    Signed delivery + retry + DLQ
│   │   └── utils/
│   │       └── webhook-signature.util.ts #    HMAC-SHA256 signature generation
│   ├── analytics/                        # 📊 Operational Analytics
│   │   ├── analytics.controller.ts       #    Performance, revenue, courier, SLA
│   │   └── analytics.service.ts          #    MongoDB aggregation pipelines
│   ├── routing/                          # 🗺️ Route Optimization & ETA
│   │   ├── routing.controller.ts         #    ETA, optimize, batch endpoints
│   │   ├── routing-engine.service.ts     #    Haversine + nearest neighbor
│   │   └── eta.service.ts               #    ETA calculation service
│   ├── metrics/                          # 📈 Prometheus Metrics
│   │   ├── metrics.module.ts             #    Metric providers (Counter, Histogram, Gauge)
│   │   ├── metrics.interceptor.ts        #    Global HTTP request/error/duration tracking
│   │   └── queue-metrics.service.ts      #    Periodic BullMQ queue depth collection
│   ├── dlq/                              # 💀 Dead Letter Queue
│   │   ├── dlq.controller.ts             #    REST API for DLQ management
│   │   ├── dlq.service.ts               #    Capture, replay, purge logic
│   │   └── dlq.module.ts                #    DLQ module registration
│   ├── health/                           # 🏥 Infrastructure Health Checks
│   │   ├── health.controller.ts          #    GET /health
│   │   └── health.module.ts              #    Health indicators
│   ├── common/                           # 🔧 Shared Utilities
│   │   ├── tracing/
│   │   │   ├── tracing.module.ts         #    Global tracing module
│   │   │   └── tracing.service.ts        #    OTel context propagation
│   │   ├── storage/
│   │   │   └── storage.service.ts        #    S3 file + base64 upload
│   │   ├── middleware/
│   │   │   └── correlation-id.middleware.ts  # X-Request-ID propagation
│   │   └── filters/
│   │       └── all-exceptions.filter.ts  #    Global exception handler
│   ├── tracing.ts                        # 🔭 OpenTelemetry SDK bootstrap
│   ├── app.module.ts                     #    Root module (Joi config validation)
│   └── main.ts                           #    Bootstrap + Swagger + RabbitMQ
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
| `JWT_SECRET` | **Yes** | — | Secret key for JWT access token signing |
| `JWT_EXPIRATION` | No | `15m` | Access token expiration |
| `JWT_REFRESH_SECRET` | No | — | Separate secret for refresh tokens |
| `JWT_REFRESH_EXPIRATION` | No | `7d` | Refresh token expiration |
| `S3_ENDPOINT` | No | — | S3-compatible endpoint URL |
| `S3_REGION` | No | `us-east-1` | S3 region |
| `S3_BUCKET` | No | `fleetpulse-pod` | S3 bucket for POD uploads |
| `S3_ACCESS_KEY_ID` | No | — | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | — | S3 secret key |
| `OTEL_EXPORTER_TYPE` | No | `jaeger` | OpenTelemetry exporter (`jaeger`, `zipkin`, `otlp`) |
| `OTEL_EXPORTER_JAEGER_ENDPOINT` | No | `http://localhost:14268/api/traces` | Jaeger collector endpoint |
| `OTEL_EXPORTER_ZIPKIN_ENDPOINT` | No | `http://localhost:9411/api/v2/spans` | Zipkin collector endpoint |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4318/v1/traces` | OTLP collector endpoint |
| `OTEL_SERVICE_NAME` | No | `fleetpulse-service` | Service name in traces |

---

## 📄 License

This project is [MIT licensed](LICENSE).
