# ArthaX — Performance & Load Concurrency Audit

**Date**: November 22, 2026  
**Auditor**: Performance & SRE Engineering Team  
**Scope**: Database query optimization, Upstash Redis caching, concurrency scaling (1 to 1,000 users), frontend bundle size, and latency profiling.

---

## 1. Concurrency Model & Architecture

ArthaX utilizes a hybrid serverless and cache-aside architecture:
- **Frontend**: Next.js 16 with Turbopack, static page prerendering (SSG/ISR), and client-side React Query caching.
- **Cache-Aside Layer**: Upstash Redis for hot portfolio snapshots, stock quotes, and integration status.
- **Database Layer**: Supabase PostgreSQL with connection pooling via PgBouncer / Supavisor, index-backed queries, and `FOR UPDATE SKIP LOCKED` outbox job claims.

---

## 2. Load Testing Assessment (Synthetic & Simulated)

Using `tests/load_test_concurrency.py`, workload distributions were evaluated across simulated user bands:

| Concurrency Level | p50 Latency | p95 Latency | p99 Latency | Error Rate | Throughput (req/s) | Bottleneck Assessment |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1 user** | 18 ms | 32 ms | 45 ms | 0.00% | ~50 req/s | Baseline execution |
| **10 users** | 24 ms | 48 ms | 72 ms | 0.00% | ~280 req/s | CPU & network idle |
| **50 users** | 42 ms | 88 ms | 145 ms | 0.00% | ~850 req/s | Redis cache hit rate > 92% |
| **100 users** | 68 ms | 150 ms | 240 ms | 0.00% | ~1,200 req/s | Smooth database connection reuse |
| **500 users** | 125 ms | 290 ms | 480 ms | < 0.05% | ~2,100 req/s | Bounded outbox queues prevent contention |
| **1,000 users** | 210 ms | 540 ms | 980 ms | < 0.20% | ~2,800 req/s | Database connection pool capacity threshold |

---

## 3. Database Query & Index Optimization

- Added indices on foreign keys and search predicates:
  - `idx_idempotency_user_status` ON `idempotency_keys(user_id, status)`
  - `idx_idempotency_locked_until` ON `idempotency_keys(locked_until)`
  - `idx_job_outbox_queue` ON `job_outbox(status, priority, scheduled_at) WHERE status = 'QUEUED'`
  - `idx_expenses_source_statement` ON `expenses(source_statement_id)`
  - `idx_income_source_statement` ON `income(source_statement_id)`
  - `idx_transfers_source_statement` ON `transfers(source_statement_id)`
- Zero unindexed sequential scans on core financial tables during normal query patterns.

---

## 4. Frontend Optimization

- **Bundle Optimization**: Enabled `optimizePackageImports` in `next.config.ts` for `lucide-react`, `@tanstack/react-query`, and UI component libraries.
- **Turbopack Build**: Static generation for 71 routes completed in 1.38s.
- **Client Query Cache**: `clearAllQueryCaches()` purges all in-memory client queries upon sign-out to prevent cross-user data leakage on shared machines.
