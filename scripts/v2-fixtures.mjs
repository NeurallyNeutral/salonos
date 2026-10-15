export async function v2Fixtures(db) {
  if (await db.prepare("SELECT id FROM tenants WHERE id='demo_boutique'").first()) return;
  await db.batch([
    db.prepare(
      "UPDATE tenants SET is_demo=1,headline='Prenez un moment pour vous.',locality='Casablanca · Exemple fictif',contact_phone='+212600000000' WHERE id IN ('t_atlas','t_rivage')",
    ),
    db.prepare(
      "INSERT INTO tenants(id,slug,name,business_mode,template,palette,headline,description,contact_phone,locality,policy_text,is_demo,reminders_enabled) VALUES ('demo_boutique','maison-sable','Maison Sable — Démo','catalog_inquiry','boutique','clay','Les essentiels, autrement.','Une boutique imaginaire pour découvrir votre future vitrine.','+212600000000','Rabat · Exemple fictif','Disponibilité et remise confirmées directement par le commerce. Aucun paiement en ligne.',1,0)",
    ),
    db.prepare(
      "INSERT INTO merchant_users VALUES ('u_boutique','demo_boutique','boutique@example.invalid','owner',1)",
    ),
    db.prepare("INSERT INTO tenant_subscription_status(tenant_id) VALUES ('demo_boutique')"),
    db.prepare(
      "INSERT INTO catalog_items(id,tenant_id,name,description,variant,price_centimes,availability) VALUES ('item_sac','demo_boutique','Sac Alba','Une silhouette simple, une texture naturelle. Illustration abstraite originale, aucun produit réel.','Sable / noir',18000,'ask'),('item_foulard','demo_boutique','Foulard Lumière','Une touche de couleur pour le quotidien.','Terracotta',9000,'available'),('item_pochette','demo_boutique','Pochette Nomade','L’essentiel à portée de main.','Écru',7000,'ask')",
    ),
  ]);
}
