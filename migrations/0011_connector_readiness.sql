ALTER TABLE tenant_provider_connections ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE connector_checks(tenant_id TEXT NOT NULL REFERENCES tenants(id),channel TEXT NOT NULL CHECK(channel IN ('email','whatsapp','instagram')),state TEXT NOT NULL CHECK(state IN ('TESTING','ERROR')),checked_at INTEGER NOT NULL,PRIMARY KEY(tenant_id,channel));
