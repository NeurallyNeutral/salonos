# SalonOS operations runbook

Scope: tested local Worker/D1 operations plus owner-controlled live procedures. No live infrastructure, real customer data or provider delivery was used. The owner must approve live provisioning, costs, deployment and personal-data processing. Never use Vercel APIs/CLI or configure automatic deployments.

## Local startup and storage

Use Node 24, `npm ci`, then `npm run demo`; see README for accounts/walkthrough. Health/readiness should return HTTP 200 at localhost:8787. Readiness checks schema/basic configuration, not provider delivery or legal approval. A 503 requires checking migration output, application key and environment.

Canonical demo storage is `.wrangler/demo/d1` plus `.wrangler/demo/app-secret` and optional `.previous`. `npm run db:local` addresses Wrangler's separate local database; it is not the demo migration command. The demo automatically applies SQL files transactionally and tracks `schema_migrations`. Keep each SQL statement, including trigger bodies, on one non-comment line. Add new migrations instead of editing applied ones. A one-time seed marker prevents deleted schedules being recreated on restart.

Stop the demo before offline maintenance. The local OS operator can provision another synthetic tenant:

~~~powershell
npm run provision:local -- --slug salon-test --name 'Salon Test' --email test@example.invalid
~~~

Restart, sign in using the mock inbox and configure services/resources/assignments/hours. No public bootstrap/admin endpoint exists. The provisioning script supports local mode only; live onboarding requires an authenticated owner/operator. Normal merchant operations require no founder intervention. Staff cannot perform owner-only configuration, provider, payment or erasure actions.

## Monitoring and messaging

- Public `/health` provides liveness; `/ready` checks configuration/schema. Neither returns customer records.
- Authenticated `/merchant/health` reports tenant queue counts, oldest due job, jobs overdue by 30 minutes and unresolved alerts. **Messages** exposes status/reasons/safe retry. Structured errors contain request IDs/types, not payloads or stack traces.
- The prospective cron runs every minute, up to 25 due jobs per invocation, prioritizing ten-minute auth links. The original fifteen-minute cadence could exceed their TTL. No live scheduler was installed or tested. Measure actual capacity before pilot and alert on missed runs, 5xx, growing backlog, uncertain messages and final failures. The owner must connect a real alert destination; live paging is not configured.
- Cron handles outbox, loyalty expiry, retention and expired operational records. The local demo processes due messages explicitly through inbox/merchant controls. Tests call the same processor.
- `pending`/`leased` mean queued; `provider_accepted` means accepted; only verified receipts mean `delivered`. Transient failures back off with a six-attempt cap. Resend uses stable keys and a 23-hour retry boundary.
- WhatsApp ambiguous responses/timeouts/expired leases enter `uncertain`. Never reset or blindly resend them. Reconcile signed receipts or investigate the provider record. Definitive rejection permits separately keyed email fallback only with email consent. Already accepted messages cannot be recalled after cancellation/unsubscribe.
- During a provider outage, preserve booking operation if safe and show delayed notifications. No exactly-once external-network guarantee is claimed.

Assign a named incident owner and backup operator before pilot. Provisional planning targets: detection within 15 minutes, independent-export RPO at most 24 hours, RTO at most 60 minutes. These are **not measured production guarantees**; obtain merchant agreement and rehearse representative volumes.

## Tested local backup and recovery

`npm run test:recovery` creates synthetic D1 appointments, a payment/refund and ledger, closes the runtime, copies a snapshot, changes the source, restores into a fresh directory and compares ten tables. It verifies claims, foreign keys, outbox/session/migration state and the restored 120-centime balance. Timings/scope are written to `artifacts/recovery.json`. This is not a live Time Travel test.

For the persistent demo, stop with Ctrl+C first. Copy the entire directory including encryption keys; copying open SQLite files is not supported:

~~~powershell
$salonosRoot = (Get-Location).Path
$salonosSource = Join-Path $salonosRoot '.wrangler\demo'
$salonosBackup = Join-Path $salonosRoot ('backups\demo-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path (Split-Path $salonosBackup) | Out-Null
Copy-Item -LiteralPath $salonosSource -Destination $salonosBackup -Recurse
~~~

Store an encrypted independent copy outside the machine, restricted to authorized operators. Backups contain customer data and keys: never commit them or attach them to a PR. Record timestamp, application commit, migration names, operator and integrity hashes in an approved inventory. This script is on-demand; it is not a remote backup service.

To restore, stop the server, select the exact backup and inspect resolved paths. Preserve the current state:

~~~powershell
# Replace the placeholder with the exact backup directory.
$salonosBackup = Join-Path (Get-Location).Path 'backups\demo-YYYYMMDD-HHMMSS'
$salonosTarget = Join-Path (Get-Location).Path '.wrangler\demo'
Get-Item -LiteralPath $salonosBackup, $salonosTarget
# Confirm both paths belong to this checkout before continuing.
$salonosPreserved = $salonosTarget + '-before-restore-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Move-Item -LiteralPath $salonosTarget -Destination $salonosPreserved
Copy-Item -LiteralPath $salonosBackup -Destination $salonosTarget -Recurse
npm run demo
~~~

Verify health/readiness, both merchant sign-ins, calendar/claims, settings, payment/refund totals, loyalty and queue states. Keep the preserved directory until verification is complete. A recovered database requires its matching key material.

## Cloudflare Time Travel and exports — BLOCKED live gate

Owner actions after approval:

1. Identify the exact staging/production account, Worker and D1 UUID. Use separate databases; never seed production with demo fixtures. Confirm available recovery window/bookmarks in the dashboard and [Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/).
2. Select a timestamp/bookmark before the incident. Pause public and merchant writes, stop cron/sends, and record the last known good application commit. Export current state to approved encrypted storage first. Record potential loss of newer legitimate writes and obtain incident-owner approval.
3. Use the authenticated account's D1 Time Travel restore for that exact database/bookmark. This replaces database state; it is not a code rollback. Never automate destructive restore from a failed health check.
4. Validate schema, `PRAGMA foreign_key_check`, occupancy, financial ledger, tenant boundaries and queue. Compare independent exports. Reconcile writes after the restore point.
5. Outbox state may roll back while external messages were already sent. Keep sends disabled until provider IDs/receipts are reconciled; quarantine uncertain WhatsApp jobs. Reapply privacy erasures/revocations recorded after the restore point.
6. Restore compatible application code, perform owner-approved smoke checks, then reopen writes/sends. Record observed RPO/RTO and sign-off. Rehearse on sample staging data before onboarding.

If independent exports are required, the owner must configure daily authenticated D1 exports to encrypted restricted storage, retention and failure alerts. Test fresh-database import quarterly and before destructive migrations. No scheduler or external storage resource was provisioned here. Local millisecond timings are not a live backup SLA.

## Key rotation and access

`APP_SECRET` protects signed offers/CSRF and encrypted booking responses, unsubscribe tokens and outbox payloads. `PROVIDER_KEK` encrypts tenant provider configuration. Each supports current plus one previous decryption key. Use random secret-manager-generated keys; never commit secrets or print them in CI. App keys need at least 32 characters. Retain previous keys securely with encrypted backups for their approved retention period.

For the **stopped local demo**:

~~~powershell
node scripts/rotate-local-key.mjs
npm run demo
~~~

The script writes the new key and retains `.previous`, then uses the non-HTTP maintenance module `src/key-rotation.ts` to re-encrypt all ciphertext stores. Repeating while `.previous` exists resumes the same rotation. Refresh merchant pages for new CSRF tokens and regenerate stale slot offers. Hashed management tokens and random unsubscribe links are independent of the signing key.

Before another rotation, verify all payloads decrypt with the new key alone, securely archive the previous key with old backups, then move `.wrangler/demo/app-secret.previous` out of the active directory. Do not destroy the only key for a backup. The regression suite tests every ciphertext table and provider configuration after old-key retirement.

For live rotation, the authenticated owner/operator must quiesce writers/sends, back up data and keys, install current+previous secrets, run the maintenance function with the correct D1 binding, verify current-only decryption and resume. Compare-and-set prevents the helper restoring erased PII. Never expose it as a public endpoint. Rotate credentials at the provider too: changing the KEK does not revoke a stolen token. Suspected compromise also requires session/link revocation and the approved incident/privacy procedure.

## Retention, privacy and financial audit

Owners can export dossiers and anonymize customers in **Clients**. Erasure cancels confirmed visits, releases their claims, revokes links, clears contact snapshots/ciphertext and suppresses pending messages. Immutable accounting rows/internal IDs remain for reconciliation; this is anonymization, not physical deletion of every financial record. Provider retention and old backups require separate handling. Audit exports/erasures.

`retention_days=0` disables automatic anonymization until policy approval. Positive values erase up to 25 inactive customers per sweep. Latest appointment end is included, and eligibility/current policy is rechecked in the transaction to prevent stale-candidate erasure after a new booking. Expired sessions/rate limits are cleaned up; old magic links/mock mail have bounded cleanup. Financial/audit/provider metadata retention still needs owner policy; no speculative blanket purge is configured.

Refunds append ledger reversals. Never edit balances/history directly. Customer merging and credit transfer are unavailable. Payments require completed visits and actual merchant receipt confirmation. No processor verification, money custody or commercial subscription collection exists. Approve credit terms, consent, review-link ownership, privacy/CNDP obligations and customer notices before real data.

## Release and rollback

Run every README check and require the PR head's full GitHub workflow to pass. Keep dependencies locked; investigate audit failures without suppressing advisories. Never skip or weaken tests. See [release checklist](RELEASE_CHECKLIST.md).

Rollback code to the last tested compatible commit through the owner-operated mechanism. Do not restore D1 merely because a UI release failed. Prefer additive migrations and forward fixes; older code may not understand new ledger semantics. For suspected booking bugs, pause public bookings, preserve claims and collect sanitized request IDs. Never delete occupancy claims while merchants continue writing.

External prerequisites: approved Cloudflare environment/secrets; Resend domain/key and signed receipt; Meta assets/templates/current contract and signed delivery; live alerts; backup/Time Travel rehearsal; commercial billing choice if collecting subscriptions; merchant contracts/privacy approval; explicit owner deployment approval. See [provider contracts](PROVIDERS.md). These remain separate from code tests. No Vercel configuration/deployment belongs to this workflow.
