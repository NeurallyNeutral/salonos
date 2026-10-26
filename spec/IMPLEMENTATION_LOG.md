# GLM implementation log — unstarted

## Durable resume state — update immediately after EVERY completed milestone or changed subtask
- CURRENT_MILESTONE: 0 (baseline; update on verified completion)
- CURRENT_FILE_OR_OPERATION: inspect baseline
- LAST_VERIFIED_COMMAND_AND_EXIT: none
- EXACT_NEXT_ACTION: record environment, dependencies, run baseline if not already confirmed
- NODE_24_VERIFIED: NO
- NPM_CI_DONE: NO
- FONT_INSTALL_DONE: NO
- OWNER_CHECKPOINT: STOP AFTER M2

**No reset rule:** A model summary is not evidence of unfinished M0/M1. Read actual changed files and last verified commands; never restart setup merely because a file-read tool returned. If looping, stop with `STATE_LOOP`; do not spend tokens restating the plan.

Baseline branch: handoff/glm53-salonos (derived from reviewed V3 e67a87ed).
Runtime: owner Linux `~/lab/build/active/salonos` with separate Hermes profile.
Status: **No GLM source changes made yet.**

## Milestones
- [ ] 0 baseline verified
- [ ] 1 tokens/components
- [ ] 2 real-looking interactive sandbox
- [ ] 3 actual customer UI
- [ ] 4 actual owner signup/onboarding
- [ ] 5 real merchant operations
- [ ] 6 test evidence and owner review package

Log each milestone: paths edited, exact commands/exit codes, remaining known defects, blocked dependencies. Do not assert screenshots or real-world validation from text-only coding.
