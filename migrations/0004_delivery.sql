ALTER TABLE notification_outbox ADD COLUMN first_attempt_at INTEGER;
CREATE TABLE notification_attempts(id TEXT PRIMARY KEY,outbox_id TEXT NOT NULL REFERENCES notification_outbox(id),attempt INTEGER NOT NULL,outcome TEXT NOT NULL,reason TEXT,created_at INTEGER NOT NULL,UNIQUE(outbox_id,attempt));
CREATE TABLE webhook_events(id TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_id TEXT NOT NULL,state TEXT NOT NULL,received_at INTEGER NOT NULL,reconciled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE tenant_provider_connections(tenant_id TEXT NOT NULL REFERENCES tenants(id),channel TEXT NOT NULL CHECK(channel IN ('email','whatsapp')),enabled INTEGER NOT NULL DEFAULT 0,config_cipher TEXT NOT NULL,PRIMARY KEY(tenant_id,channel));
CREATE TABLE mock_deliveries(id TEXT PRIMARY KEY,outbox_id TEXT NOT NULL UNIQUE,channel TEXT NOT NULL,payload_cipher TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE mock_behavior(channel TEXT PRIMARY KEY,outcome TEXT NOT NULL CHECK(outcome IN ('ok','retryable','final','uncertain')));
CREATE TABLE operations_alerts(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),kind TEXT NOT NULL,subject TEXT NOT NULL,created_at INTEGER NOT NULL,resolved_at INTEGER,UNIQUE(tenant_id,kind,subject));
