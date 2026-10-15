# SalonOS discovery engine — separate lead pipeline (V2)
Goal: daily shortlist of genuinely recently launched / newly announced Morocco-based service and Instagram-first microbusinesses. This is a SALES OPERATIONS workflow, not core merchant runtime.

## Finding leads responsibly
Collect candidates from authorized sources: business submissions, consented referrals, relevant public web/search results, Google Business information subject to applicable terms, business directories, owner-provided websites and official Instagram API endpoints for which we have permissions. Meta automated collection/scraping outside authorized access is prohibited by its terms; do not build bypass/sockpuppet/browser scraping infrastructure.
Do not automatically DM cold prospects or generate unsolicited bulk marketing. Human reviews targeted outreach and channel compliance. Store only minimal business-facing information and respect opt-outs.

## Lead record schema proposal
source_url, source_type, business_display_name, business_category, locality, website/Instagram URL, discovered_at, first_seen_at, launch_evidence_url, launch_evidence_date, launch_confidence, booking_mode, currently_has_website_or_booking_link, publicly listed business contact, inferred operational pain (with rationale), target_offer, demo_preview_id, outreach_status, suppression_reason, next_followup_at, notes, human_verification, source_terms.

Never equate `first_seen_at` with founding date. New IG account / fewer than 50 followers != low customer volume / new business.

## Ranking
Prioritize newly opened and socially active appointment-led services; no website or booking link; multiple services; high inquiry pressure; owner reachable through an appropriately permitted channel; onboarding fit; likely positive ROI. Low followers alone receives little weight. For retail, catalog/quote workflow must fit before ranking.
Use scoring with rationale, not fabricated revenue or number of customers.

## Daily report and offer
Summarize ten strongest deduplicated leads with verifiable URL, reason, outreach suggestion, one appropriate template and owner-approved personalized preview. Do not scrape/post/copy copyrighted logos/photos without permission. No outreach automation until human authorizes each send and terms/compliance reviewed.

## Experiment metrics
New valid qualified candidates/day, qualified conversations, replies, demos, paid activations, onboarding duration, retained merchants, revenue per customer, support minutes. Attribution must distinguish leads discovered by the agent from customers organically converted via a client's storefront. No made-up case-study figures.

## Operational design
Keep discovery data, rate budgets and credentials separate from booking/customer DB wherever possible. A scheduled job can propose a shortlist for review, but must not silently activate merchants, send messages, or charge anything.
