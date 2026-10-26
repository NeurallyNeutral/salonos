# Owner-operated transfer and Hermes invocation (DO NOT run as GLM)

Target Linux account: `darpapichulo@NSA-DCS-269`. This is a PROJECT, not a tool. Target checkout: `/home/darpapichulo/lab/build/active/salonos`. No new `~/repos` or `software/ours` root.

## A. Source transfer without model GitHub access
On Dell/owner-controlled browser, download ZIP of GitHub branch `handoff/glm53-salonos`. Do not give a coding model GitHub credentials, signed URLs, remote, or CI tools.
Owner Windows CMD:
```cmd
ssh -o ConnectTimeout=8 darpapichulo@NSA-DCS-269 "mkdir -p ~/lab/build/inbox ~/lab/build/active"
scp "%USERPROFILE%\Downloads\salonos-glm.zip" darpapichulo@NSA-DCS-269:~/lab/build/inbox/
ssh darpapichulo@NSA-DCS-269
```
Rename the downloaded ZIP to `salonos-glm.zip` before SCP. If `NSA-DCS-269` DNS does not resolve, owner uses their known Tailscale/LAN SSH hostname.
Linux owner shell:
```bash
set -e
mkdir -p ~/lab/build/inbox/salonos-unpack ~/lab/build/active/salonos
unzip -q ~/lab/build/inbox/salonos-glm.zip -d ~/lab/build/inbox/salonos-unpack
src="$(find ~/lab/build/inbox/salonos-unpack -mindepth 1 -maxdepth 1 -type d | head -n 1)"
test -f "$src/AGENTS.md" && test -f "$src/package.json"
cp -a "$src"/. ~/lab/build/active/salonos/
cd ~/lab/build/active/salonos
test ! -d .git || (echo 'WARNING: Git metadata present; owner must inspect remote' && git remote -v)
ls spec
# Owner creates a LOCAL-ONLY Git baseline (never add a remote).
if [ ! -d .git ]; then
  git init -q
  git add -A
  git -c user.name="SalonOS Local Owner" -c user.email="salonos-local@example.invalid" commit -qm "Local clean baseline"
fi
test -z "$(git remote)"
```
Owner ensures target directory was empty/new before copying. ZIP deliberately contains no .git remote. Model may use local source tools but must not get GitHub access.

## B. Separate Hermes profile (isolation of **context**, not OS sandbox)
```bash
hermes profile list
hermes profile create salonos-coder
hermes -p salonos-coder setup
hermes profile show salonos-coder
cd ~/lab/build/active/salonos
hermes -p salonos-coder chat --toolsets file,terminal
```
During **owner-operated** `setup`, choose **Blank Slate / minimal tools**, then configure OpenRouter provider, model `z-ai/glm-5.3`, and enter your credential in Hermes' private config (do not paste key into source or chat). Use your own capped key/budget; set `terminal.cwd` to project path in that profile if supported. Profile `--clone-all` is PROHIBITED because it carries unrelated memory/skills; blank profile preferred. `hermes -p` avoids changing the user's active default profile.
A Hermes profile isolates memory, skills and config **but does not technically restrict OS file access**. Use `--toolsets file,terminal` on every session: unlike the default coding bundle, this excludes browser, web/search, GitHub MCP, memory search, skills, delegation, cron and background research tools. In the profile-only `config.yaml`, set `terminal.home_mode: profile` (if installed-version supports it) to avoid inheriting the host user's ordinary SSH/GitHub CLI home; this **still is not a filesystem sandbox**. For stronger isolation, run under a dedicated restricted OS account/container with only the checkout and model credential mounted. Verify actual enabled tools with `hermes -p salonos-coder tools`.

## C. First instruction to paste
```text
You are the SalonOS code-only implementer. Work exclusively in the current directory.
Read AGENTS.md and spec/00_START_HERE.md through spec/06_DELIVERY_AND_TESTS.md, in order.
Do not read old repository histories or other home folders. Do not use browser/web/GitHub/CI, sudo, deployments, external integrations, cron or unattended tasks. Do not re-design anything.
Implement exactly spec/05_FILE_PLAN.md milestones, using spec/01 exact typography/colors/layout and spec/02 screens, spec/03 copy/state and spec/04 existing API contracts. Keep backend security/accounting logic unchanged.
Before writing code, return a brief file-order checklist and verify baseline commands if dependencies exist. Then implement locally milestone by milestone, logging files and actual tests. Don't claim visual inspection.
If network/package install needed, stop that operation and ask owner; proceed with tasks that do not require it.
```

## D. Budget and review
Run GLM only in foreground. Use owner-approved capped OpenRouter key; **verify the ACTUAL resolved model** before coding. `z-ai/glm-5.3` (full) and `z-ai/glm-flash` / `glm-5.3-flash` are different model tiers; if the interface reports Flash when full GLM 5.3 was intended, STOP and ask the owner to correct model routing. No autonomous tool/model escalation or provider fallback. Do not let any agent schedule background tasks. Owner reviews diffs and starts actual app with `npm run demo` on their own machine after source transfer/patch. Do not deploy or give GLM GitHub credentials. Do not add random skills/prompts to this handoff.

## E. Strong warning
A plain Hermes profile is **not** a root/filesystem jail, and 'don't browse GitHub' is only a procedural rule if the process still has network and account-wide credentials. Use a separate OS user/container for actual technical enforcement if necessary. Repository visibility is an owner setting; the source was observed PUBLIC on 26 Oct 2026. Do not change repository visibility automatically.
