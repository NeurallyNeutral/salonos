import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export type Row = Record<string, any>;
export type Env = { DB: D1Database; ENVIRONMENT: string; APP_BASE_URL: string; APP_SECRET: string; EMAIL_PROVIDER?: string; WHATSAPP_PROVIDER?: string; RESEND_API_KEY?: string; EMAIL_FROM?: string; META_APP_SECRET?: string; META_VERIFY_TOKEN?: string; RESEND_WEBHOOK_SECRET?: string; PROVIDER_KEK?: string };
export type App = { Bindings: Env; Variables: { merchant: Row; rawSession: string } };
export type Ctx = Context<App>;
export const now = () => Date.now();
export const id = () => crypto.randomUUID();
export const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export function fail(status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503, message: string): never { throw new HTTPException(status, { message }); }
export function str(v: unknown, max = 120): string { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) fail(400, 'invalid_text'); return v.trim(); }
export function integer(v: unknown, min: number, max: number, step = 1): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max || v % step) fail(400, 'invalid_number'); return v; }
export function flag(v: unknown): number { if (v !== true && v !== false && v !== 0 && v !== 1) fail(400, 'invalid_boolean'); return Number(v); }
export function email(v: unknown): string { const s = str(v, 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail(400, 'invalid_email'); return s; }
export function phone(v: unknown): string { const s = str(v, 20).replace(/[\s()-]/g, ''); if (!/^\+[1-9]\d{7,14}$/.test(s)) fail(400, 'invalid_phone'); return s; }
export async function hash(s: string): Promise<string> { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join(''); }
export async function hmac(secret: string, s: string): Promise<string> { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join(''); }
export function equal(a: string, b: string): boolean { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
export async function seal(secret: string, value: unknown): Promise<string> { const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12)); const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)))); return 'v1.' + btoa(String.fromCharCode(...iv, ...enc)); }
export async function unseal(secret: string, value: string): Promise<any> { if (!value.startsWith('v1.')) fail(400, 'invalid_cipher'); const bytes = Uint8Array.from(atob(value.slice(3)), c => c.charCodeAt(0)); const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['decrypt']); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)))); }
export const stmt = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
export const rows = async (db: D1Database, sql: string, ...args: any[]): Promise<Row[]> => (await stmt(db, sql, ...args).all<Row>()).results;
export const audit = (db: D1Database, tenant: string, actor: string, action: string, subject: string | null = null) => stmt(db, 'INSERT INTO audit_log VALUES (?,?,?,?,?,?)', id(), tenant, actor, action, subject, now());
export function owner(c: Ctx): Row { const m = c.get('merchant'); if (m.role !== 'owner') fail(403, 'owner_required'); return m; }
export function local(c: Ctx): boolean { return ['development','test'].includes(c.env.ENVIRONMENT) && ['localhost','127.0.0.1'].includes(new URL(c.req.url).hostname); }
export async function limit(c: Ctx, scope: string, maximum: number, period = 60000) { const key = await hash(scope + ':' + (c.req.header('CF-Connecting-IP') || 'local')); const window = Math.floor(now() / period); const result = await stmt(c.env.DB, 'INSERT INTO rate_limits VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END, window=excluded.window RETURNING count', key, window).first<Row>(); if (result!.count > maximum) fail(429, 'rate_limited'); }
