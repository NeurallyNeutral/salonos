INSERT OR IGNORE INTO tenants(id,slug,name) VALUES ('t_atlas','atelier-atlas','Atelier Atlas — Démo'),('t_rivage','studio-rivage','Studio Rivage — Démo');
INSERT OR IGNORE INTO merchant_users VALUES ('u_atlas','t_atlas','atlas@example.invalid','owner',1),('u_rivage','t_rivage','rivage@example.invalid','owner',1),('u_staff','t_atlas','staff@example.invalid','staff',1);
INSERT OR IGNORE INTO services(id,tenant_id,name,duration_min,buffer_min,price_centimes) VALUES ('s_atlas','t_atlas','Coupe signature',20,0,12000),('s_long','t_atlas','Soin et coiffage',50,10,24000),('s_rivage','t_rivage','Soin signature',20,0,12000);
INSERT OR IGNORE INTO resources(id,tenant_id,name) VALUES ('r_atlas','t_atlas','Équipe Atlas'),('r_rivage','t_rivage','Équipe Rivage');
INSERT OR IGNORE INTO service_resources VALUES ('t_atlas','s_atlas','r_atlas'),('t_atlas','s_long','r_atlas'),('t_rivage','s_rivage','r_rivage');
WITH d(value) AS (VALUES (0),(1),(2),(3),(4),(5),(6)) INSERT OR IGNORE INTO weekly_hours SELECT 'h_'||t.id||'_'||d.value,t.tenant_id,t.id,d.value,540,1080 FROM resources t CROSS JOIN d;
INSERT OR IGNORE INTO tenant_subscription_status(tenant_id) VALUES ('t_atlas'),('t_rivage');
