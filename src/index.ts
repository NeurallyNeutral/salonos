import { Hono } from 'hono'

type Bindings = { DB: D1Database; APP_BASE_URL: string; ENVIRONMENT: string }
const app = new Hono<{ Bindings: Bindings }>()

// Safe starting point: do not expose insecure scaffold endpoints in a public Worker.
app.get('/health', (c) => c.json({ ok: true, service: 'SalonOS', phase: 'handoff' }))
app.get('/ready', (c) => c.json({ ok: false, reason: 'not_implemented' }, 503))
app.get('/', (c) => c.text('SalonOS development build — not ready for customers'))

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, _env: Bindings, _ctx: ExecutionContext) {
    // Codex: implement durable, idempotent notification queue processing in M3.
  },
}
