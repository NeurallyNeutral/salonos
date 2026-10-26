# 01 — Immutable visual system: fonts, palette, geometry and motion

This is a **measurable UI contract**, not a moodboard. Implement the exact defaults below; never interpret style adjectives yourself.

## Typography (self-hosted, fixed families)
- Headline serif: **Instrument Serif**, weight 400, normal; italics only for 1–2 editorial emphasis words. Source `@fontsource/instrument-serif@5.3.0`, OFL-1.1.
- Interface sans: **Manrope**, weights 400 / 500 / 600 / 700; source `@fontsource/manrope@5.3.0`, OFL-1.1.
- Package fonts as **self-hosted assets** from the pinned packages; do NOT depend on runtime third-party font CDNs. Keep license notice and do not publish font binaries separately from the app. Fallback `Georgia, serif` and `"Segoe UI", sans-serif`.
- `h1` customer: 64px/1.02 desktop, 44px/1.06 mobile, Instrument Serif. `h2` customer: 40px/1.1 desktop, 32px mobile. Product name: 25px serif.
- Merchant page title: 36px/1.08 desktop, 30px mobile Instrument Serif. All merchant cards, labels and navigation Manrope. Merchant section heading 22px/1.2 sans 700.
- Body 16px/1.55 regular; controls 15px/1.3 weight 600; helper 13px/1.45; captions 12px/1.4; never use body below 14px for essential text.

## Color tokens (copy this mapping; no other active palette)
```css
:root {
  --s-paper: #F7F4EE;       /* page, customer */
  --s-canvas: #EDE7DD;      /* stage/background */
  --s-white: #FFFFFF;       /* cards */
  --s-ink: #252C29;         /* text */
  --s-muted: #637068;       /* secondary text */
  --s-line: #D7D4CC;        /* border */
  --s-forest: #28473F;      /* PRIMARY button, nav, focus-independent */
  --s-forest-dark: #19342E;
  --s-clay: #B76E50;        /* rare editorial accent */
  --s-sand: #D8BE99;        /* decorative */
  --s-success: #256747;
  --s-danger: #AE403A;
  --s-warning: #946126;
  --s-focus: #145FA0;
  --s-merchant-bg: #F3F4F0;
  --s-merchant-sidebar: #1D332E;
}
```
- Customer dominant colors: paper / ink / forest; warm sand in visual art only.
- Merchant dominant colors: `merchant-bg`, white surfaces, dark forest sidebar, ink. Status green/warning/red only when semantic.
- Primary buttons: forest fill, white text. Secondary: transparent, 1px forest outline. Destructive: white with danger text/border until confirmed.
- No gradients, glassmorphism, neon, stock purple, rainbow cards, unrelated feature colors, arbitrary emoji, or tilted paper-card scene as the hero.

## Spacing & geometry
- Unit scale: `4, 8, 12, 16, 24, 32, 48, 64, 96` pixels. All gaps/margins map to these.
- Customer full-width section max-width **1184px**, desktop outer inset 48px; mobile side insets 20px. 12-column desktop grid; 4-column mobile conceptual grid. Product cards desktop 3-up at 24px gap, tablet 2-up, mobile 1-up or horizontal scroll only if interaction proves discoverable.
- Merchant workspace at >=1024px: left fixed **248px** sidebar + content region padding **32px**; at 768–1023px sidebar **76px** icons with accessible labels; below 768px use a simple sticky header and **four-item bottom navigation** `Aujourd’hui`, `Activité`, `Catalogue/Prestations`, `Plus`. No horizontally clipped tab strips.
- Merchant content max-width **1140px**; actionable today area at top. Card radius **12px** (merchant) / **6px** (customer editorial panels); input radius **8px**; border 1px solid line; shadows only on raised dialogs `0 18px 42px rgba(28,45,37,.12)`.
- Buttons min-height **48px**; touch targets min **44x44px**; input min-height **52px**; forms one visible label per field above input; label gap 8px; input help gap 6px. Form column max-width **520px**; modal max-width 560px.
- Real onboarding outer max-width **1040px**, split illustration/info 38% and form 62% desktop; mobile stacked with illustration reduced to 120px. Exactly one task panel per step, no multiple hidden legacy forms in DOM.
- Desktop header height 76px; mobile header 64px. Use non-animated scrolling for keyboard focus.

## Layout defaults
- Customer storefront hero desktop: 55% copy left and 45% relevant photo/right; mobile image after headline then single CTA. Hero h1 is the **merchant name** or merchant-written headline, not a SalonOS ad.
- Merchant Today screen: page title/operational date -> alerts strip if any -> action cards (today's bookings OR unresolved inquiries) -> one row small metrics -> shortcuts. Do not lead with vanity KPIs.
- Content density: no more than 2 large cards above fold on 390x844 where practical. Move optional/explanatory text behind Help/Info; keep genuinely required legal disclosures near action.
- Customer storefront has no `Créer ma vitrine`, `Espace professionnel`, nor local mock inbox navigation.

## Sketch animation — exact usage
Only three named illustrations, implemented as accessible decorative SVG:
1. `storeOpening`: two shutters unfold around a storefront silhouette when choosing business type (650ms total, one-shot).
2. `mailArrival`: an envelope slides 16px, flap opens and a small check appears on simulated demo Email tab (450ms).
3. `bookingTransfer`: one small filled circle follows a curved connector from calendar slot to merchant agenda row (600ms), only when synthetic booking is confirmed.
All line art uses forest strokes at 1.75px, occasional sand circles, **no abstract squiggles or technical blueprints**. UI micro transitions 160–220ms ease-out. Demo scene crossfade 240ms. Respect `prefers-reduced-motion: reduce` (0ms transitions, static final SVG state). Never block data entry during animations.

## Imagery, copy and assets
- Use only **licensed, owner-supplied, or newly designed fictional illustrations** in demo. Do not fetch copyrighted photos without explicit rights. If no approved photos are available, use product-specific CSS/SVG objects (folded scarf, bottle, tote silhouette, manicure implements) in realistic editorial containers, **not single oversized initials**. App allows merchant-owned images via existing upload flow.
- Copy in French (Morocco) with MAD, `Africa/Casablanca` aware date/time. No faux metrics, testimonials, 5-star ratings or invented sales success.
- English technical statuses stay behind an advanced diagnostics surface; show translated user-friendly states.
- Ensure contrast WCAG AA in all interactive text; visible 2px focus ring `--s-focus` with 2px offset.
- Production no third-party font/image requests; local assets or CSS/SVG only.

## Responsive breakpoints
`0–599px` phone, `600–767px` large phone, `768–1023px` tablet, `>=1024px` desktop. Test 360x800, 390x844, 768x1024, 1440x900. No horizontal overflow anywhere.
