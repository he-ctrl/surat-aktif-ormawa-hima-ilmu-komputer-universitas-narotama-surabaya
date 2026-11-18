// Helper server-side untuk Upstash KV (store yang sama dengan Kronos dan
// LogiTrack) + akun owner dan sesi login.
// Kunci: surat-aktif:templates, surat-aktif:template-file:<id>,
// surat-aktif:users, surat-aktif:sessions.
// Catatan Upstash: POST /set/<key> menyimpan body APA ADANYA — jadi nilai
// JSON dikirim sebagai string JSON mentah, dan base64 sebagai string mentah.

import { createHash, randomBytes } from 'crypto';

const KV_URL = (process.env.KV_REST_API_URL || '').replace(/\/$/, '');
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

export const TEMPLATES_KEY = 'surat-aktif:templates';
export const USERS_KEY = 'surat-aktif:users';
export const SESSIONS_KEY = 'surat-aktif:sessions';
export const SESSION_COOKIE = 'surat_owner_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_OWNER = { username: 'owner', password: 'owner123' };

export function kvConfigured() {
  return Boolean(KV_URL && KV_TOKEN);
}

async function kvFetch(path, opts = {}) {
  const res = await fetch(`${KV_URL}${path}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
    ...opts,
  });
  return res;
}

export async function kvGetRaw(key) {
  const res = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.result === 'string' ? data.result : null;
}

export async function kvSetRaw(key, value) {
  const res = await kvFetch(`/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: String(value),
  });
  return res.ok;
}

export async function kvDel(key) {
  const res = await kvFetch(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
  return res.ok;
}

export async function kvGetJson(key, fallback) {
  const raw = await kvGetRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function kvSetJson(key, obj) {
  return kvSetRaw(key, JSON.stringify(obj));
}

export function hashPassword(password, salt) {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

export function newSalt() {
  return randomBytes(16).toString('hex');
}

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
}

export async function getUsers() {
  const users = await kvGetJson(USERS_KEY, null);
  if (Array.isArray(users)) return users;
  // Seed pertama kali: akun owner default, wajib ganti password saat login pertama.
  const seed = [{
    username: DEFAULT_OWNER.username,
    salt: newSalt(),
    hash: '',
    mustChangePassword: true,
  }];
  seed[0].hash = hashPassword(DEFAULT_OWNER.password, seed[0].salt);
  await kvSetJson(USERS_KEY, seed);
  return seed;
}

export async function getSessions() {
  return kvGetJson(SESSIONS_KEY, []);
}

export async function createSession(username) {
  const sid = randomBytes(24).toString('hex');
  const sessions = await getSessions();
  sessions.push({ sid, username, createdAt: new Date().toISOString() });
  await kvSetJson(SESSIONS_KEY, sessions.slice(-50));
  return sid;
}

export async function deleteSession(sid) {
  const sessions = await getSessions();
  await kvSetJson(SESSIONS_KEY, sessions.filter((s) => s.sid !== sid));
}

export async function getSessionUser(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!m) return null;
  const sessions = await getSessions();
  const s = sessions.find((x) => x.sid === m[1]);
  if (!s) return null;
  if (Date.now() - new Date(s.createdAt).getTime() > SESSION_TTL_MS) return null;
  return s.username;
}

export function sessionCookieHeader(sid) {
  return `${SESSION_COOKIE}=${sid}; HttpOnly; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
