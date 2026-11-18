// Gambar tanda tangan (PNG) yang dipakai di pratinjau, PDF, dan DOCX.
// GET: kembalikan PNG efektif — yang diunggah owner (KV surat-aktif:signature,
// base64) bila ada, kalau tidak ada pakai file bawaan public/tanda-tangan-hendryk.png.
// POST (owner saja): unggah PNG baru (maks. 500 KB, dicek magic bytes PNG).
// DELETE (owner saja): kembali ke tanda tangan bawaan.

import { readFile } from 'fs/promises';
import path from 'path';
import {
  SIGNATURE_KEY,
  kvConfigured,
  kvGetRaw,
  kvSetRaw,
  kvDel,
  getSessionUser,
} from '../../lib/kv.js';

const MAX_BYTES = 500 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function GET() {
  try {
    if (kvConfigured()) {
      const b64 = await kvGetRaw(SIGNATURE_KEY);
      if (b64) {
        return new Response(Buffer.from(b64, 'base64'), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        });
      }
    }
  } catch { /* jatuh ke file bawaan bila KV gagal */ }
  try {
    const file = await readFile(path.join(process.cwd(), 'public', 'tanda-tangan-hendryk.png'));
    return new Response(file, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Tanda tangan bawaan tidak ditemukan.' }, { status: 404 });
  }
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  if (!kvConfigured()) return Response.json({ error: 'Database belum terhubung.' }, { status: 503 });
  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Form tidak bisa dibaca.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'Pilih file PNG tanda tangan.' }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return Response.json({ error: 'File kosong.' }, { status: 400 });
  if (buf.length > MAX_BYTES) {
    return Response.json({ error: `File terlalu besar (${Math.round(buf.length / 1024)} KB). Maksimal 500 KB.` }, { status: 400 });
  }
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return Response.json({ error: 'File bukan PNG. Unggah gambar tanda tangan berformat PNG.' }, { status: 400 });
  }
  await kvSetRaw(SIGNATURE_KEY, buf.toString('base64'));
  return Response.json({ ok: true, bytes: buf.length });
}

export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  if (!kvConfigured()) return Response.json({ error: 'Database belum terhubung.' }, { status: 503 });
  await kvDel(SIGNATURE_KEY);
  return Response.json({ ok: true });
}
