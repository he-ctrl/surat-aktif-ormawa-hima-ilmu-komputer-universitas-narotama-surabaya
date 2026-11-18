// Pengaturan situs — saat ini hanya format nomor surat.
// GET: publik (dibutuhkan semua pengunjung saat nomor dibuat di pratinjau).
// POST: owner saja — simpan format baru (dicek placeholder-nya).

import {
  SETTINGS_KEY,
  kvConfigured,
  kvGetJson,
  kvSetJson,
  getSessionUser,
} from '../../lib/kv.js';
import { DEFAULT_NOMOR_FORMAT, validateNomorFormat } from '../../lib/nomorFormat.js';

export async function GET() {
  let nomorFormat = DEFAULT_NOMOR_FORMAT;
  try {
    if (kvConfigured()) {
      const s = await kvGetJson(SETTINGS_KEY, null);
      if (s && typeof s.nomorFormat === 'string' && s.nomorFormat.trim()) {
        nomorFormat = s.nomorFormat;
      }
    }
  } catch { /* pakai format bawaan bila KV gagal */ }
  return Response.json({ nomorFormat });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  if (!kvConfigured()) return Response.json({ error: 'Database belum terhubung.' }, { status: 503 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body tidak bisa dibaca.' }, { status: 400 });
  }
  const err = validateNomorFormat(body?.nomorFormat);
  if (err) return Response.json({ error: err }, { status: 400 });
  const nomorFormat = body.nomorFormat.trim();
  await kvSetJson(SETTINGS_KEY, { nomorFormat });
  return Response.json({ ok: true, nomorFormat });
}
