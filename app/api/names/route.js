// API penyimpanan nama yang sudah pernah dibuat suratnya.
// Dipakai halaman utama untuk saran nama (autocomplete) dan pengisian
// otomatis NIM, prodi, dan jabatan.
// Penyimpanan: Vercel KV (Upstash) — env KV_REST_API_URL + KV_REST_API_TOKEN
// disuntikkan otomatis Vercel saat database KV dibuat & ditautkan ke proyek.
// Tanpa env tersebut, API tetap jalan tapi mengembalikan daftar kosong
// (formulir surat tetap berfungsi normal).

export const dynamic = 'force-dynamic';

const KEY = 'surat-aktif:records';
const MAX_RECORDS = 200;

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet() {
  const res = await fetch(
    `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(KEY)}`,
    { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }, cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data || typeof data.result !== 'string') return [];
  try {
    const parsed = JSON.parse(data.result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function kvSet(records) {
  const res = await fetch(
    `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(KEY)}/${encodeURIComponent(JSON.stringify(records))}`,
    { method: 'POST', headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
  );
  return res.ok;
}

function cleanRecord(body) {
  const nama = String(body?.nama ?? '').trim();
  const nim = String(body?.nim ?? '').trim();
  const prodi = String(body?.prodi ?? '').trim();
  const jabatan = String(body?.jabatan ?? '').trim();
  if (!nama) return null;
  return { nama, nim, prodi, jabatan, updatedAt: new Date().toISOString() };
}

export async function GET() {
  if (!kvConfigured()) return Response.json({ records: [], db: false });
  try {
    const records = await kvGet();
    return Response.json({ records, db: true });
  } catch {
    return Response.json({ records: [], db: false });
  }
}

export async function POST(request) {
  if (!kvConfigured()) {
    return Response.json({ ok: false, error: 'database belum dikonfigurasi' }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'body bukan JSON' }, { status: 400 });
  }
  const record = cleanRecord(body);
  if (!record) {
    return Response.json({ ok: false, error: 'nama wajib diisi' }, { status: 400 });
  }
  try {
    const records = await kvGet();
    const idx = records.findIndex(
      (r) => String(r.nama).trim().toLowerCase() === record.nama.toLowerCase()
    );
    if (idx >= 0) records[idx] = record;
    else records.unshift(record);
    const trimmed = records.slice(0, MAX_RECORDS);
    const saved = await kvSet(trimmed);
    if (!saved) return Response.json({ ok: false, error: 'gagal menyimpan' }, { status: 500 });
    return Response.json({ ok: true, records: trimmed });
  } catch {
    return Response.json({ ok: false, error: 'gagal menyimpan' }, { status: 500 });
  }
}
