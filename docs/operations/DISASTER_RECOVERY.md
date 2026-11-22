# ArthaX — Disaster Recovery & Business Continuity Plan

**Date**: November 22, 2026  
**Auditor**: Site Reliability Engineering Team  
**RPO Target**: < 1 hour  
**RTO Target**: < 30 minutes

---

## 1. Database Disaster Recovery (Supabase PostgreSQL)

### Continuous WAL Archiving & Point-In-Time Recovery (PITR)
- Supabase provides automated daily snapshots and continuous Write-Ahead Log (WAL) archiving for Pro/Enterprise instances.
- In the event of catastrophic data corruption, accidental table drops, or bad migrations:
  1. Navigate to `Database -> Backups` in the Supabase Dashboard.
  2. Select `Point in Time Recovery`.
  3. Specify the recovery timestamp immediately preceding the incident.
  4. Initiate restore to a new branch or replace production.

### Logical Backup Strategy
In addition to managed PITR, automated logical backups (`pg_dump`) should be scheduled nightly:
```bash
pg_dump -h db.<PROJECT_REF>.supabase.co -U postgres -d postgres -F c -b -v -f "arthax_backup_$(date +%Y%m%d).dump"
```
Encrypted dumps must be archived to an independent cloud storage bucket (AWS S3 or Google Cloud Storage) with bucket versioning enabled.

---

## 2. Cryptographic Emergency Key Rotation Runbook

In the event of suspected key compromise of `ENCRYPTION_MASTER_KEY`:
1. Generate a new high-entropy master key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update Vercel environment variables:
   - Set `ENCRYPTION_MASTER_KEY` to `<NEW_KEY>`.
   - Set `ENCRYPTION_MASTER_KEY_PREVIOUS` to `<OLD_KEY>`.
3. Deploy the application: Existing ciphertext will continue to decrypt using the fallback key.
4. Execute key rotation script across active broker integrations and tokens:
   - Re-encrypt all records using `rotateEncryptionKey()`.
5. Once all records are rotated, delete `ENCRYPTION_MASTER_KEY_PREVIOUS` from environment variables.

---

## 3. Incident Response Protocol

| Incident Type | Severity | Initial Action | Escalation Contact |
| :--- | :---: | :--- | :--- |
| **OAuth State Forgery / Replay** | P0 | Check `oauth_state_nonces` table, verify `OAUTH_STATE_SECRET` | Security Architect |
| **Database Connection Exhaustion** | P1 | Verify PgBouncer pooling mode, scale compute size | Lead DBA |
| **OCR / Python Parser Crash** | P1 | Check temporary disk storage, verify PDF bounds | Python Systems Lead |
| **Redis Cache Outage** | P2 | Cache-aside fallback activates automatically | DevOps Engineer |
