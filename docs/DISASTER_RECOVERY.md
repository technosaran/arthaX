# ArthaX Disaster Recovery & Business Continuity Plan

## 1. Objectives & RTO / RPO Targets
- **Recovery Point Objective (RPO)**: <= 1 Hour (Automated continuous database WAL archiving and point-in-time recovery via Supabase).
- **Recovery Time Objective (RTO)**: <= 15 Minutes for web/API tier; <= 1 Hour for database failover.

---

## 2. Failure Scenarios & Recovery Runbooks

### 2.1 Complete Vercel Outage or Region Disruption
- **Detection**: Sentry health alert or synthetic ping failure.
- **Action**:
  1. Inspect status of secondary Vercel regions (e.g. `sin1` / Singapore).
  2. If primary region `bom1` is degraded, update `vercel.json` regions to `["sin1"]` or failover to Cloudflare Pages / Railway mirror.
  3. Deploy via git push or manual trigger.

### 2.2 Database Corruption or Unintended Record Deletion
- **Protection**: Supabase Point-in-Time Recovery (PITR) maintains continuous WAL logs up to 7–30 days.
- **Action**:
  1. Open the Supabase Project Dashboard -> Database -> Backups.
  2. Select **Point in Time Recovery**.
  3. Specify the exact timestamp prior to the corruption/deletion incident.
  4. Restore to a dedicated recovery branch or target database.
  5. Verify record counts and validate data integrity before repointing production connection strings.

### 2.3 Redis Cache Outage or Network Partition
- **Impact**: Transient degradation in rate-limiting resolution speed.
- **Mitigation**: All Redis calls in `src/utils/redis.ts` and `src/utils/rateLimit.ts` are wrapped in try/catch blocks with automatic fallback to graceful degradation and local in-memory counters. The application will never throw a 500 error solely because Redis is unreachable.

### 2.4 Broker Token Revocation or Integration Expiration
- **Impact**: Zerodha Kite or Binance sync fails with 401 Unauthorized.
- **Mitigation**:
  1. The automated cron detects expired access tokens and logs an explicit notification.
  2. The frontend Settings -> Integrations panel prompts the user with a one-click re-authorization flow.
  3. Historical transactions and holdings remain intact and are never wiped due to sync failures.
