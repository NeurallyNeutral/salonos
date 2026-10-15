# Discovery is separate sales operations

Run `npm run discovery:dry-run` with Node 24. This imports twelve fictional candidates into an isolated in-memory SQLite database and writes `artifacts/discovery-report.json` with the strongest ten unsuppressed, deduplicated candidates and scoring rationales. All source URLs use example.invalid. No network requests, scraping, outreach, merchant activation or charges occur.

Authorized local import: `node scripts/discovery.mjs --file PATH_TO_AUTHORIZED_JSON --authorized-source`. This explicit operator action stores data in ignored `.wrangler/discovery/authorized.sqlite`, separate from merchant/customer D1. Do not commit imports, databases or reports containing real businesses. Node's built-in SQLite is used only for this offline tool; the merchant Worker still requires no Node/Redis/Postgres runtime.

Record source type and terms, public business URL/name/category/locality, discovery and first-seen dates, any launch-evidence URL/date, human verification, business mode/fit, booking-link presence, and optionally consent/authorization evidence, permitted business contact, pain rationale, offer, authorized preview, status/suppression, follow-up and notes. A referral requires consent evidence; official API records require authorization evidence. Scraped Instagram is not an accepted source.

Canonical source URLs deduplicate query parameters, fragments, www prefixes and trailing slashes. Suppression survives reimport and always removes a candidate from the shortlist. Imports validate the complete batch before any mutation and use an SQLite transaction.

Scoring rewards human-checked recent launch evidence and explicit workflow fit, missing booking/site link, multiple services, documented inquiry pressure and appropriately permitted contact. Follower counts contribute zero. First-seen is never treated as founding date; missing launch evidence remains unverified. Scores express prioritization, not forecast sales or verified opportunity counts.

Each report proposes a standard appointments or boutique template and human review only. An authorized preview must use merchant-provided/approved content and owned assets. No automated send exists. Future measurement needs owner-recorded qualified conversations/replies/demos/paid activations/retention/support; a dry-run shortlist provides none of that evidence. No recurring job has been installed.

To delete authorized discovery data, close the CLI and delete its explicitly named database/report locally. Do not mix this data with storefront customers or use it to enroll a merchant. Source eligibility and any individual outreach require human review of applicable channel terms.
