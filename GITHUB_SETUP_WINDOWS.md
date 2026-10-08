# GitHub setup on Windows

The private repository already exists at https://github.com/NeurallyNeutral/salonos. The initial safe import and M0–M5 were published, with M6 tracked in PR #1 on `codex/pilot-implementation`. Do not initialize another repository or replace its history.

This workspace used the authorized GitHub connector because native Git credentials could not access the repository. Local and API commit IDs may differ, but publication verifies identical Git tree hashes. Only NeurallyNeutral/salonos is authorized; keep it private.

For ordinary native Git work, authenticate as the owner through Git Credential Manager (or install GitHub CLI and run `gh auth login --hostname github.com --git-protocol https --web`, then `gh auth setup-git`). Never paste a token into source, a remote URL or a chat. Clone a fresh checkout of the remote branch if you need its exact remote commit ancestry; preserve this workspace and any uncommitted work.

~~~powershell
git clone --branch codex/pilot-implementation https://github.com/NeurallyNeutral/salonos.git salonos-clean
Set-Location salonos-clean
npm ci
npm run demo
~~~

No external deployment follows from a push or merge. CI performs local tests only. Vercel deployment, project linking and automatic deployment configuration remain forbidden to the agent. Cloudflare provisioning/deployment also requires explicit owner approval.
