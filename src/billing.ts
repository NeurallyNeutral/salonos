import type { Env } from './core';
import { id, stmt, now } from './core';
// Commercial collection remains disabled. Adapters cannot claim customer processor verification.
export interface BillingEvent {
  id: string;
  tenant_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
}
export interface BillingProvider {
  mode: 'disabled' | 'mock';
  apply(event: BillingEvent): Promise<void>;
}
export class DisabledBillingProvider implements BillingProvider {
  readonly mode = 'disabled';
  async apply(_event: BillingEvent): Promise<void> {
    throw new Error('live_billing_not_configured');
  }
}
export class MockBillingProvider implements BillingProvider {
  readonly mode = 'mock';
  constructor(private env: Env) {}
  async apply(event: BillingEvent) {
    if (!['test', 'development'].includes(this.env.ENVIRONMENT))
      throw new Error('mock_billing_forbidden');
    await stmt(
      this.env.DB,
      "INSERT OR IGNORE INTO subscription_events VALUES (?,?, 'mock',?,?,?)",
      id(),
      event.tenant_id,
      event.id,
      event.status,
      now(),
    ).run();
  }
}
