# Historical materials — do NOT deploy

`worker_scaffold/`: October 6 prototype built for Cloudflare. Includes incomplete availability checks, unauthenticated merchant view, queued-but-unsent reminders and insufficient booking collision safety.

`interactive_demo/`: October 7 Node and browser simulation. Has unauthenticated API/state and in-memory database; browser UI keeps fake local state separate from API. Useful only as design and interaction reference.

Both are raw files preserved for CodeX review. Root `src/index.ts` is the only application entrypoint and intentionally exposes health/status only. Migrate safely under tests.
