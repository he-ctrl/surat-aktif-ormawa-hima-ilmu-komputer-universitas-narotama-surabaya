// Login owner (pengelola template). Pengguna biasa TIDAK perlu login.
// Akun owner pertama kali dibuat otomatis: owner / owner123, wajib ganti
// password saat login pertama (mustChangePassword).
// Sesi: cookie httpOnly surat_owner_session, 7 hari.

export const dynamic = 'force-dynamic';

import {
  kvConfigured, getUsers, kvSetJson, USERS_KEY, hashPassword, newSalt,
  createSession, deleteSession, getSessionUser,
  sessionCookieHeader, clearSessionCookieHeader, SESSION_COOKIE,
} from '../../lib/kv.js';

export async function GET(request) {
  if (!kvConfigured()) return Response.json({ user: null, db: false });
  try {
    const username = await getSessionUser(request);
    return Response.json({ user: username ? { username } : null, db: true });
  } catch {
    return Response.json({ user: null, db: false });
  }
}

export async function POST(request) {
  if (!kvConfigured()) return Response.json({ error: 'database belum dikonfigurasi' }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'body bukan JSON' }, { status: 400 }); }
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  if (!username || !password) return Response.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
  try {
    const users = await getUsers();
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || hashPassword(password, user.salt) !== user.hash) {
      return Response.json({ error: 'Username atau password salah.' }, { status: 401 });
    }
    const sid = await createSession(user.username);
    const res = Response.json({ ok: true, username: user.username, mustChangePassword: !!user.mustChangePassword });
    res.headers.set('Set-Cookie', sessionCookieHeader(sid));
    return res;
  } catch {
    return Response.json({ error: 'gagal login' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (m) { try { await deleteSession(m[1]); } catch { /* abaikan */ } }
  const res = Response.json({ ok: true });
  res.headers.set('Set-Cookie', clearSessionCookieHeader());
  return res;
}

export async function PATCH(request) {
  if (!kvConfigured()) return Response.json({ error: 'database belum dikonfigurasi' }, { status: 503 });
  const username = await getSessionUser(request);
  if (!username) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'body bukan JSON' }, { status: 400 }); }
  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');
  if (newPassword.length < 6) return Response.json({ error: 'Password baru minimal 6 karakter.' }, { status: 400 });
  try {
    const users = await getUsers();
    const idx = users.findIndex((u) => u.username === username);
    if (idx < 0) return Response.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    if (hashPassword(currentPassword, users[idx].salt) !== users[idx].hash) {
      return Response.json({ error: 'Password lama salah.' }, { status: 401 });
    }
    const salt = newSalt();
    users[idx] = { ...users[idx], salt, hash: hashPassword(newPassword, salt), mustChangePassword: false };
    await kvSetJson(USERS_KEY, users);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'gagal mengubah password' }, { status: 500 });
  }
}
