INSERT INTO tenants (id, slug, name, phone, email) VALUES ('tenant_demo','demo-salon','Demo Salon','+212600000000','owner@example.com');
INSERT INTO resources (id, tenant_id, name) VALUES ('resource_1','tenant_demo','Principal');
INSERT INTO services (id, tenant_id, name, description, duration_min, price_mad, sort_order) VALUES
('svc_1','tenant_demo','Piercing lobe','Réservation lobe',20,60,1),
('svc_2','tenant_demo','Hair tinsel','Pose hair tinsel',30,120,2),
('svc_3','tenant_demo','Hair straightening','Lissage / consultation',90,300,3);
INSERT INTO service_resources (service_id, resource_id) VALUES ('svc_1','resource_1'),('svc_2','resource_1'),('svc_3','resource_1');
