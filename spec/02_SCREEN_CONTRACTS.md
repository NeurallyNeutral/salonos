# 02 — Exact screens, diagrams, routes and responsive wireframes

**Rule:** Each section below describes DOM, order, navigation, visual hierarchy, and state. Do not substitute text-only story slides for UI mockups. No hidden V2 mega-form retaining all steps in a single render.

## A. Entry distinctions

REAL customer link /shop/:slug -> merchant-branded page immediately; no business-type selector; no SalonOS top-level nav.
REAL new merchant /signup -> actual verified-email -> /setup (business type first). User creates a real private tenant only after server verification.
DEMO /demo -> show vertical cards first. All following scenes are fictional; a labeled sandbox badge remains visible. A persistent 3-tab top row is Vitrine | E-mail | Espace commerce, with Email active only during the simulated verification scene or when revisited. A visible button toggles Vue client / Vue commerce.

**Required demo state:** vertical = salon|boutique; perspective = client|merchant; scene; synthetic_email; verification_simulated; selected_item; selected_time; synthetic_customer; synthetic_event; completed. In-memory only, reset clears all. Browser Back/Forward should restore scene deterministically via history state or query parameters without altering real app.

## B. /demo landing, also REAL /setup?step=mode first panel
Desktop 1440x900:
```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ SalonOS                                    DÉMONSTRATION                    FR     │ 76px
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│   [small eyebrow: VOTRE COMMERCE, CLAIREMENT]                                       │
│   Découvrez la version qui vous ressemble.                                         │ serif 64px
│   Choisissez une activité. Passez ensuite côté client ou côté commerce.            │
│                                                                                    │
│   ┌─────────────────────────────┐       ┌─────────────────────────────┐            │
│   │ [salon still-life illustration]      │ [folded textile illustration]│            │
│   │ Salon & rendez-vous         │       │ Boutique & produits         │            │
│   │ Horaires → réservation      │       │ Catalogue → demande         │            │
│   │ [Explorer ce parcours →]    │       │ [Explorer ce parcours →]    │            │
│   └─────────────────────────────┘       └─────────────────────────────┘            │
│                                                                                    │
│   Aucun compte ni paiement réel.  [Recommencer la visite]                           │
└────────────────────────────────────────────────────────────────────────────────────┘
```
Cards width 460px, gap 24, illustration height 220px. Entire entry's primary action is selection. Selected vertical saved through all demo tabs. Mobile 390px stacks 2 cards, image height 120, h1 44px, 20px margins and top 64px. Real setup mode choice shows same content but uses header "Que souhaitez-vous gérer ?" and no "démonstration" caption.

## C. DEMO shell (consistent everywhere after choosing)
Desktop: header 76px, main background paper. Left side 56% real-looking UI viewport (storefront or dashboard), right 44% annotation rail max 360px only one 2-sentence caption + Next button. No rotated paper cards. At mobile, full-width UI first, caption collapsed under a "Pourquoi c'est utile ?" disclosure. Simulated event happens within UI.
Header includes <SalonOS wordmark> [Salon ▾ / Boutique ▾] [Vitrine | E-mail | Espace commerce] [DÉMO FICTIVE] and [Recommencer].
Footer fixed at bottom only in guided demo: [Retour] 03 / 07 [Suivant →]. Steps tied to completing actions; pressing Suivant may advance fictional actions but cannot skip unfinished input validation. Keep all buttons >=44px.

DEMO MERCHANT sequence, exactly seven scenes:
M0 vertical selection -> M1 "Créez votre accès" show real-looking email form with display-only synthetic email and CTA "Continuer"; M2 switch to dedicated Email tab with animated message and button "Vérifier mon adresse"; M3 show mode-specific 3-step setup (business name, service/product, public link); M4 show preview/publish synthetic confirmation with /demo fictional URL; M5 switch Vitrine and complete fictional booking/inquiry; M6 switch Espace commerce to show the SAME synthetic event in Today/Inquiries row, with "Répondre/ouvrir" action; M7 retention example (optional next, not an invented delivered message) and "Demander une démonstration" CTA. Count 7 content scenes after entry if M0 excluded.
DEMO CUSTOMER: vertical selection -> C1 merchant storefront -> C2 choose service/stock item -> C3 choose time OR variant + quantity -> C4 contact and consent fictional form -> C5 confirmation with correct truthful distinctions -> C6 Espace commerce receiving same event. No real network calls.
Email tab shows "1 nouveau message" only after M1 submission and after 300ms deterministic animation, sender `SalonOS (simulation)`, subject `Confirmez votre accès à Atelier Aube` / `... Maison Sable`; button "Vérifier mon adresse" advances. Do not claim an email was actually sent.

## D. REAL customer: salon (routes /shop/:slug and /book/:slug)
Route `/shop/:slug`: no SalonOS sign-up nav. Hero [logo/photo with genuine authorized rights] [brand] [headline] [primary Réserver] [hours/contact]. Service list of horizontal rows each with price, duration, "Choisir" action. A service row navigates `/book/:slug?service=ID&source=...`; service persisted.
`/book/:slug`: visible **four-step** progress component: Prestation -> Date & heure -> Coordonnées -> Confirmation.
(1) Prestation: selected service name, duration, price, change link; optional resource/staff if current API supports.
(2) Date/time: tenant-local calendar; disable unavailable/past; selected chip state and primary "Continuer".
(3) Contact: name, phone, optional email/consent; concise exact reservation summary with service/date/time/price and venue. Button "Confirmer le rendez-vous".
(4) Result: booking reference, exact date/time, management link, neutral "Votre réservation est confirmée" only after Worker returns success; if service does not require deposit, "Aucun paiement en ligne". On conflict, retain data, show "Ce créneau vient d’être réservé" and return to step (2).
Management `/manage` must preserve existing secret links and server semantics; offer clear cancel/reschedule, confirmation and back navigation. No false provider delivery guarantee.
Mobile: 1 column, sticky bottom primary CTA (with scroll padding), summary collapsible until confirmation, month navigation accessible.

## E. REAL customer: boutique (route /shop/:slug)
Boutique brand header; 2/3-column image-led product grid desktop, one card per row mobile. Each card: item art/photo, name, human readable price + "indicatif" qualifier if actual checkout not offered, actual availability state, button "Demander cet article" if available.
Selecting item opens dedicated focused product detail view or inline sheet **adjacent to selected item**, never at bottom after unrelated product cards. Keep product image/name/variant/qty visible.
Form: name, Moroccan/international phone, optional email, variant, quantity 1..20, optional note, contact consent. Submit "Envoyer ma demande"; no "Commander" or "Payer" because backend only creates inquiry.
Response: "Demande envoyée" + item/quantity + human readable follow-up statement "Le commerce vous contactera pour confirmer la disponibilité et les modalités. Aucun stock réservé, aucun paiement." Generated reference appears but is not the hero. After reload, do not invent persisted client receipt: make Back to shop clear; add persisted receipt only if secure backend mechanism is designed and tested.
Example item art with own SVG: folded foulard "Foulard Lumière", ceramic bottle, canvas tote; NOT initial letters.

## F. REAL merchant onboarding flow
Do not reuse a huge HTML template and toggle hidden forms. Render exactly ONE form for each route state; verified session required from server before setup.

```text
/create-or-signup [real email] --actual provider email--> [mailbox OUTSIDE application]
          |                                             |
          v                                             v
 [dedicated "Consultez votre e-mail" status] --one-use verified link--> [mode choice]
     -- Salon --> [business identity] --> [first service + hours] --> [preview] --> [publish] --> [Today]
     -- Boutique --> [business identity] --> [first product]       --> [preview] --> [publish] --> [Inquiries]
```
Real `/signup` uses two screens in app: email input and check-inbox status. After submission show only: headline "Vérifiez votre adresse", partially masked email (no disclosure of account existence), "Renvoyer le lien" obeying server rate limits, "Changer d'adresse" back, "J'ai besoin d'aide" plain support (no fabricated live support). **No in-app mock inbox link in the standard flow**. If local TEST MODE, an isolated dev control reachable from a separate explicit `/dev` page may open mock messages; never in user-facing real signup scene. Local-only routing remains server protected.
Mode choice precedes all business identity fields; keep chosen mode in provisional tenant draft. UI must show back/change mode prior to activity.
Step identity: `name` REQUIRED, `slug` auto-suggest from name but editable, `contact_phone` REQUIRED (+212 example), `locality` OPTIONAL. `headline`/`description` and privacy/policy field use safe explicit defaults and are editable on "Informations avancées". No style or palette selection here.
Step first offering:
 Salon: service name, duration (30m default), price MAD, weekly days and hours presented as editable checkboxes for Mon–Sun (not implicit every day), default Mon–Sat 09:00–18:00, Sunday CLOSED; comply with API schedule semantics. If existing API cannot do that in one operation, first create service and then call existing hours endpoint in one clear UI step, with error recovery and no false transactional guarantee across separate calls.
 Boutique: product name, indicative price, optional variant, availability; button Add another product; can proceed with one.
Step preview: realistic customer storefront in framed phone viewport, edit relevant step links, checklist [name valid] [public contact] [one offer] [hours for Salon] [policies]. No separate publication button on preview.
Step publish: explain visible public data (business name, contact, offerings, policy), unchecked merchant ownership/policy attestations, one primary "Publier ma vitrine". After successful Worker response present shareable actual URL and copy button + QR download. Optional upload/brand/logo and integration are **after** completion.
Onboarding uses 4 required stages after real email (mode, identity, offer, preview+publish may be grouped), no clutter. Each step displays 01/04 etc and save/resume status.

## G. REAL merchant operations
Desktop fixed left sidebar `Aujourd’hui | Agenda/Demandes | Clients | Prestations/Catalogue | Paiements & fidélité | Indicateurs | Réglages` + bottom `Aide et compte`. Mobile bottom bar only 4 sections plus More submenu.
Mode-specific:
SALON Today → today's confirmed visits sorted ascending, count of cancellations/action alerts, primary `Ajouter un rendez-vous` defaults to tenant-local TODAY and requires selected future time; `Agenda` goes day/week; `Prestations` manages offers/people/hours; client details and actual payments behind their respective tabs.
BOUTIQUE Today → latest incoming inquiries with New/Contacted/Fulfilled/Cancelled states, open inquiry in dedicated detail sheet; catalog editing under separate tab; money actions under separate tab.
At top: merchant title and small status [Vitrine publiée / brouillon / pause]; `Voir ma vitrine` link; no demo onboarding callouts for active merchants.
Search `/merchant/inquiries?offset=...&q=...` supports name/phone/item/id; changes reset offset=0. Show active filter and number of records returned, Next Older link. Nothing silently disappears at 100.
Card labels distinguish customer-requested amount from merchant-reported received money; no platform payment processing claims. Loyalty shows 0/1/2% and opt-in consent; review prompts are neutral for everyone eligible.

## H. Error/empty/loading states
Exactly one main loading skeleton per screen; after 8 seconds show retry and preserve draft, no infinite spinner. Failures near field and summary notice. Empty Today: `Aucun rendez-vous aujourd’hui.` + `Ajouter un rendez-vous`; empty boutique: `Aucune demande en attente.` + `Voir la vitrine`. No dummy events presented as real. Draft state: resume CTA. Disconnect state: translated "Non connecté", not "DISCONNECTED" with technical API instructions in primary view.

## Notes
- Every screen from this contract must be implemented for both real mode and sandbox appearance; design components may share templates, but data adapters may differ.
- On demo scenes user may inspect mock emails but no real signup; on real screens use the genuine provider flow.
