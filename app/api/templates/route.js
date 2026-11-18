// Daftar & kelola template surat.
// GET: publik — daftar metadata template (bawaan + kustom), tanpa isi file.
// POST: owner saja — unggah DOCX baru. Server membaca word/document.xml,
//       mem-parsing placeholder {parameter | tipe | opsi}, lalu menyimpan
//       file (base64) dan metadatanya di KV.
// DELETE: owner saja — hapus template kustom (bawaan tidak bisa dihapus).
// PATCH: owner saja — jadikan template utama (isDefault) atau ubah nama/deskripsi.

export const dynamic = 'force-dynamic';

import JSZip from 'jszip';
import { BUILTIN_TEMPLATE } from '../../lib/builtinTemplate.js';
import { parsePlaceholders, extractDocxText, findSplitTokens } from '../../lib/parseTemplate.js';
import {
  kvConfigured, kvGetJson, kvSetJson, kvSetRaw, kvDel, getSessionUser, newId, TEMPLATES_KEY,
} from '../../lib/kv.js';

const MAX_FILE_BYTES = 500 * 1024; // 500 KB — base64-nya ~670 KB, aman di bawah batas 1 MB Upstash

async function getCustomTemplates() {
  return kvGetJson(TEMPLATES_KEY, []);
}

function fileKey(id) {
  return `surat-aktif:template-file:${id}`;
}

export async function GET() {
  const customs = kvConfigured() ? await getCustomTemplates().catch(() => []) : [];
  const anyCustomDefault = customs.some((t) => t.isDefault);
  const builtin = { ...BUILTIN_TEMPLATE, isDefault: !anyCustomDefault };
  const templates = [builtin, ...customs];
  templates.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)
    || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return Response.json({ templates, db: kvConfigured() });
}

export async function POST(request) {
  if (!kvConfigured()) return Response.json({ error: 'database belum dikonfigurasi' }, { status: 503 });
  const username = await getSessionUser(request);
  if (!username) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Form tidak terbaca.' }, { status: 400 }); }
  const name = String(form.get('name') || '').trim();
  const description = String(form.get('description') || '').trim();
  const file = form.get('file');
  if (!name) return Response.json({ error: 'Nama template wajib diisi.' }, { status: 400 });
  if (!file || typeof file === 'string') return Response.json({ error: 'File DOCX wajib diunggah.' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: `File terlalu besar (${Math.round(file.size / 1024)} KB). Maksimal 500 KB — kompres gambar di dalam dokumen lalu unggah ulang.` }, { status: 400 });
  }
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { return Response.json({ error: 'File tidak bisa dibaca.' }, { status: 400 }); }
  // File .doc (Word lama, format biner OLE) tidak bisa diisi seperti .docx
  // (zip + XML) — deteksi dari ekstensi maupun magic bytes-nya, lalu arahkan
  // owner untuk menyimpan ulang sebagai .docx di Word/WPS.
  const isOle = bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (/\.doc$/i.test(file.name || '') || isOle) {
    return Response.json({ error: 'File .doc (format Word lama) belum bisa dipakai langsung. Buka di Word/WPS, lalu File → Save As → pilih “Word Document (*.docx)”, simpan, dan unggah file .docx-nya.' }, { status: 400 });
  }
  if (!/\.docx$/i.test(file.name || '')) return Response.json({ error: 'File harus berformat .docx.' }, { status: 400 });
  let documentXml;
  try {
    const zip = await JSZip.loadAsync(bytes);
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('no xml');
    documentXml = await f.async('string');
  } catch { return Response.json({ error: 'File bukan DOCX yang valid.' }, { status: 400 }); }
  const text = extractDocxText(documentXml);
  const { params, warnings } = parsePlaceholders(text);
  const splitTokens = findSplitTokens(documentXml, text);
  const id = newId('tpl');
  const base64 = Buffer.from(bytes).toString('base64');
  const okFile = await kvSetRaw(fileKey(id), base64);
  if (!okFile) return Response.json({ error: 'Gagal menyimpan file template.' }, { status: 500 });
  const customs = await getCustomTemplates();
  const template = {
    id, name, description, kind: 'custom', isDefault: false,
    fileBytes: file.size, createdAt: new Date().toISOString(), params,
  };
  customs.push(template);
  const okMeta = await kvSetJson(TEMPLATES_KEY, customs);
  if (!okMeta) {
    await kvDel(fileKey(id));
    return Response.json({ error: 'Gagal menyimpan template.' }, { status: 500 });
  }
  return Response.json({ ok: true, template, warnings, splitTokens });
}

export async function DELETE(request) {
  if (!kvConfigured()) return Response.json({ error: 'database belum dikonfigurasi' }, { status: 503 });
  const username = await getSessionUser(request);
  if (!username) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  if (!id || id === BUILTIN_TEMPLATE.id) return Response.json({ error: 'Template bawaan tidak bisa dihapus.' }, { status: 400 });
  const customs = await getCustomTemplates();
  const next = customs.filter((t) => t.id !== id);
  if (next.length === customs.length) return Response.json({ error: 'Template tidak ditemukan.' }, { status: 404 });
  await kvSetJson(TEMPLATES_KEY, next);
  await kvDel(fileKey(id));
  return Response.json({ ok: true });
}

export async function PATCH(request) {
  if (!kvConfigured()) return Response.json({ error: 'database belum dikonfigurasi' }, { status: 503 });
  const username = await getSessionUser(request);
  if (!username) return Response.json({ error: 'Harus login sebagai owner.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'body bukan JSON' }, { status: 400 }); }
  const id = String(body?.id || '');
  const customs = await getCustomTemplates();
  if (body?.isDefault) {
    if (id === BUILTIN_TEMPLATE.id) {
      customs.forEach((t) => { t.isDefault = false; });
    } else {
      const t = customs.find((x) => x.id === id);
      if (!t) return Response.json({ error: 'Template tidak ditemukan.' }, { status: 404 });
      customs.forEach((x) => { x.isDefault = x.id === id; });
    }
    await kvSetJson(TEMPLATES_KEY, customs);
    return Response.json({ ok: true });
  }
  const t = customs.find((x) => x.id === id);
  if (!t) return Response.json({ error: 'Template tidak ditemukan.' }, { status: 404 });
  if (typeof body?.name === 'string' && body.name.trim()) t.name = body.name.trim();
  if (typeof body?.description === 'string') t.description = body.description.trim();
  await kvSetJson(TEMPLATES_KEY, customs);
  return Response.json({ ok: true, template: t });
}
