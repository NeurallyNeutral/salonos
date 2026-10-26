# 03 — State machines, form schemas, exact interaction copy

## State machines (implement reducers or equivalent explicit state, no distributed accidental globals)
```text
SANDBOX
ENTRY -> MODE_SELECTED -> {CUSTOMER_STOREFRONT, MERCHANT_EMAIL_ENTRY}
MERCHANT_EMAIL_ENTRY --valid display-only email--> EMAIL_PENDING
EMAIL_PENDING --open simulated message--> EMAIL_VERIFIED_SIMULATED
EMAIL_VERIFIED_SIMULATED -> SETUP_IDENTITY -> OFFER -> PREVIEW -> PUBLISHED_SYNTHETIC
PUBLISHED_SYNTHETIC -> CUSTOMER_EVENT_CREATED -> MERCHANT_EVENT_VISIBLE -> END
RESET -> ENTRY (clear every field/event; no backend mutation)
BACK -> exact previous scene; preserve data; disable destructive repeated fictitious events

REAL
ANONYMOUS -> SIGNUP_REQUESTED -> CHECK_INBOX -> VERIFIED_SESSION
VERIFIED_SESSION -> MODE -> IDENTITY_DRAFT -> FIRST_OFFER -> PREVIEW -> PUBLISHED
PUBLISHED -> TODAY
Any step -> SAVED_DRAFT -> same step after reload; every transition guarded
```
No UI-only "verified" flag can grant a real session. Backend session GET is authority. Sandbox has `demo=true`, never shares real session state.

## Locale and validation (must align with server)
- Required real shop `name`: trim, 1–100 characters (server plain validator), `slug`: lowercase ASCII `^[a-z][a-z0-9-]{2,59}$`, no spaces or accents, suggest normalization but require conscious slug on publication, conflict displays `Cette adresse est déjà utilisée. Choisissez-en une autre.`.
- Real signup email: RFC-like reasonable HTML `type=email` and server `email()`, max 254. Invalid `Vérifiez votre adresse e-mail.`.
- Phone: E.164 backend `^\+[1-9]\d{7,14}$`; UI accepts display `06 12 34 56 78`, `+212 6 12 34 56 78` for Morocco using **safe explicit normalization** (leading 0 -> +212; 212 prefix -> +212; trim spaces/hyphen/parentheses; preserve already valid +country); show normalized value for confirmation. Do not modify backend international E.164 accepted semantics. Error `Saisissez un numéro marocain (ex. 06 12 34 56 78) ou international (+212 6 12 34 56 78).`.
- `price`: user input MAD decimal comma or point, maximum two decimals; transform to integer centimes, never floats in ledger; prevent NaN/overflow. `duration` 5–240 minutes divisible by 5. `quantity` integer 1–20. Validate while leaving field/submit, not immediately on first keystroke.
- `consent_contact`: explicit checked before inquiry request; do not pre-check consent marketing. Business publication attestations must be unchecked, server checked.
- A booking on occupied slot returns conflict and refreshes slots, not blank form. Idempotency keys stable through retry of identical payload, regenerated on meaningfully edited new submission.
- Passwords not added. HTML `pattern` must be valid under Chromium Unicode `v`; or omit pattern and use JS+server validation. Do NOT implement fragile regex escaped in HTML string.

## Field behavior (single reusable form controller)
Each field renders:
`<label for=...>Field name</label>` + `<input id=... aria-describedby=... autocomplete=... inputmode=...>` + hint + error slot `role=alert` only when invalid.
- Input border default #D7D4CC, focus 2px #145FA0, invalid #AE403A.
- Validate on blur if non-empty; validate all on submit; clear error after correction; always keep other fields.
- Submit button disabled only while awaiting one request; finally reenabled even on error. Double clicks produce one server write via existing idempotency; no stale disabled state.
- After server failure, scroll first invalid field into view and focus; show summary notice with actual reason. Offline/network failure: `Connexion interrompue. Vos informations sont conservées. Réessayez.`.
- Select/input mutations must not silently reset unrelated values. Back navigation restores step state; reload uses persisted provisional tenant for real setup, in-memory/session for sandbox.

## Copy dictionary (use EXACT wording; no creative placeholder marketing)
- Demo badge: `DÉMONSTRATION · DONNÉES FICTIVES`
- Demo entry: `Quel commerce souhaitez-vous découvrir ?`
- Mode salon card: `Salon & rendez-vous` / `Réservations simples, journée organisée.`
- Mode boutique card: `Boutique & produits` / `Présentez vos articles, recevez les demandes.`
- Experience switch: `Vue client`, `Vue commerce`
- Sandbox tabs: `Vitrine`, `E-mail`, `Espace commerce`
- Sandbox email entry: `Votre adresse pour la démonstration` / `Continuer`; after valid entry show `Un message arrive dans l'onglet E-mail.`
- Sandbox email sender `SalonOS — simulation`, subject `Vérifiez votre adresse`, CTA `Vérifier mon adresse`, helper `Cet e-mail est fictif. Rien n'a été envoyé.`
- Real signup title `Créez votre espace commerce.`; field `Adresse e-mail professionnelle`; CTA `Recevoir mon lien de vérification`.
- Real pending title `Vérifiez votre adresse.`; text `Ouvrez le lien à usage unique que nous venons de préparer pour votre adresse. Si vous ne l'avez pas reçu, réessayez.`; actions `Renvoyer le lien`, `Changer d'adresse`. Be honest when provider not configured: `L'envoi d'e-mails n'est pas disponible dans cet environnement.`
- Merchant setup next `Continuer`, back `Retour`, save `Enregistré`, error `Nous n'avons pas pu enregistrer cette étape.`
- Preview `Voici la vitrine que vos clients verront.`, publish `Publier ma vitrine`, published `Votre vitrine est en ligne.`, share `Copier le lien`.
- Salon booking `Choisissez un soin`, `Choisissez une date et une heure`, `Vos coordonnées`, `Vérifiez votre réservation`, CTA `Confirmer le rendez-vous`, result `Rendez-vous confirmé`.
- Salon price label `Prix affiché`; boutique price `Prix indicatif`.
- Boutique CTA `Demander cet article`, form CTA `Envoyer ma demande`, success `Demande envoyée`, helper `Le commerce confirmera la disponibilité et les modalités. Aucun stock réservé, aucun paiement effectué.`
- Merchant today `Aujourd'hui`, salon `Rendez-vous à venir`, boutique `Demandes à traiter`, primary `Ajouter un rendez-vous` / `Voir les demandes`.
- Success states: `En attente`, `Contact pris`, `Remise effectuée`, `Annulée`; connectivity `Non connecté`, `En cours de vérification`, `Connecté`, `Action nécessaire`.
- No actual provider delivery: `Les rappels automatiques ne sont pas activés.`, not `Envoyé`.
- Demo end CTA `Parlons de votre commerce` (not fake booking a consultation).

## Event consistency contract
Each fictional `DEMO_BOOKING_CONFIRMED` creates event `{id, vertical:'salon', status:'confirmed', serviceName, dateLocal, timeLocal, customerName:'Cliente de démonstration'}`. The agenda visual row reads from this exact object. A `DEMO_INQUIRY_SENT` creates event `{id,vertical:'boutique',status:'new',itemName, variant,quantity,customerName:'Cliente de démonstration'}`; merchant inquiry list reads same object. No fake payment. "Email" only simulates identity.
If user switches vertical, reset mode-specific event and selection; show clear confirmation before discarding edited state. Restart clears whole sandbox.

## Deep link and URL rules
- Demo routes: `/demo` selects; `/demo/salon/client`, `/demo/salon/merchant`, `/demo/boutique/client`, `/demo/boutique/merchant` (can use one SPA renderer if web server resolves these); `/demo/email` returns email scene while keeping chosen mode. Preserve old `/demo/customer` and `/demo/merchant` through redirects or compatibility bridge that now starts at mode choice. No blank root on static build.
- Real product remains `/shop/:slug`, `/book/:slug`, `/login`, `/signup`, `/setup`, `/dashboard`; avoid changing public API or private manage token routes.
- Old Vercel paths `/client.html`, `/merchant.html` should redirect to supported demo entry; static `index.html` required. Never rely on platform-specific redirect config alone when a simple HTML fallback works.
