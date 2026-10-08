# Connect this handoff to Codex/GitHub on Windows

There was no dedicated SalonOS repository in the connected GitHub account at handoff, and these tools cannot create a new repository. Do NOT add this project to the unrelated existing couture/caftan repo.

## Easiest local Codex path
1. Unzip `SalonOS_Codex_Handoff.zip` once into a directory.
2. Open the extracted folder as a Codex working directory (Codex desktop or CLI, depending on your installation).
3. Paste `CODEX_START_PROMPT.txt`. Codex should read `AGENTS.md` automatically; explicitly ask it to read if necessary.
4. Review its first plan and authorize local edits. Cloud credentials and production changes require explicit approval.

## Preferred Git-backed path
1. Create a new **private**, empty repository named `salonos` under your own GitHub account. Do not initialize with a conflicting README.
2. Open PowerShell in the extracted handoff folder.
3. Use the following (requires git installed):

```powershell
git init -b main
git add .
git commit -m "chore: SalonOS Codex handoff and safe bootstrap"
git remote add origin https://github.com/NeurallyNeutral/salonos.git
git push -u origin main
```

Replace the remote URL if you name the repository differently. GitHub authentication is handled by your installed credential manager; no passwords/tokens in commits.

Then open `NeurallyNeutral/salonos` in Codex and paste the starter prompt. Grant Codex GitHub source-code permissions for this private repository (commits, branches, PRs, issues, CI), but **never** allow Codex to deploy or configure auto-deployment through Vercel; only the owner may deploy there.

In ChatGPT, the GitHub account may already be connected, but newly created repositories must be authorized under **Settings > Plugins > GitHub > manage repository access**. In Codex Cloud, select this repository when creating a cloud environment. Codex Cloud only sees files committed to the repository or explicitly made available in its environment: local handoff ZIP downloads are not magically accessible to the cloud agent.
