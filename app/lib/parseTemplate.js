// Parse {parameter | tipe | opsi} placeholders dari teks dokumen.
// Format yang didukung (di dalam file DOCX template):
//   {nama | string}
//   {prodi | dropdown | Sistem Komputer, Teknik Informatika, Sistem Informasi}
//   {jabatan | radio | Sekretaris, Bendahara, Dokumentasi, Humas}
//   {nama}                       -> string (tipe boleh dihilangkan)
//   {{nama}}                     -> gaya lama, juga string
// Alias tipe: text=string, selection/select=dropdown.
// {tanggal} dan {nomor} adalah parameter sistem — diisi otomatis, bukan form.

export const PARAM_TYPES = {
  string: 'string',
  text: 'string',
  dropdown: 'dropdown',
  selection: 'dropdown',
  select: 'dropdown',
  radio: 'radio',
};

export const SYSTEM_PARAMS = new Set(['tanggal', 'nomor']);

const NAME_RE = /^[A-Za-z][A-Za-z0-9 _-]*$/;
const ACRONYMS = { nim: 'NIM' };

export function labelize(name) {
  const key = name.trim().toLowerCase();
  if (ACRONYMS[key]) return ACRONYMS[key];
  const n = name.trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Ambil teks polos dari word/document.xml (buang semua tag).
export function extractDocxText(documentXml) {
  return String(documentXml || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

const TOKEN_RE = /\{\{([^{}]+)\}\}|\{([^{}]+)\}/g;

// Cari semua placeholder di teks polos. Kembalikan { params, warnings }.
// params: [{ name, label, type: 'string'|'dropdown'|'radio', options: [] }]
export function parsePlaceholders(text) {
  const params = [];
  const warnings = [];
  const seen = new Set();
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text || '')) !== null) {
    const raw = m[0];
    const inner = (m[1] ?? m[2]).trim();
    const isLegacy = raw.startsWith('{{');
    const parts = inner.split('|').map((s) => s.trim());
    const name = parts[0] || '';
    if (!NAME_RE.test(name)) {
      warnings.push(`Placeholder tidak valid dan diabaikan: ${raw}`);
      continue;
    }
    const key = name.toLowerCase();
    if (SYSTEM_PARAMS.has(key)) continue; // tanggal/nomor diisi otomatis
    if (seen.has(key)) continue; // pakai kemunculan pertama
    seen.add(key);
    let type = 'string';
    let options = [];
    if (!isLegacy && parts[1]) {
      const t = PARAM_TYPES[parts[1].toLowerCase()];
      if (!t) warnings.push(`Tipe "${parts[1]}" tidak dikenal pada ${raw} — dipakai sebagai teks.`);
      else type = t;
    }
    if ((type === 'dropdown' || type === 'radio') && parts[2]) {
      options = parts[2].split(',').map((s) => s.trim()).filter(Boolean);
    }
    if ((type === 'dropdown' || type === 'radio') && options.length === 0) {
      warnings.push(`${raw}: dropdown/radio tanpa opsi — dipakai sebagai teks.`);
      type = 'string';
    }
    params.push({ name, label: labelize(name), type, options });
  }
  return { params, warnings };
}

// Token yang ditemukan di teks tapi TIDAK muncul utuh di XML mentah —
// artinya Word memotong teksnya ke beberapa run (terjadi kalau placeholder
// diketik lalu diedit di tengah kata). Penggantian literal akan gagal
// untuk token ini; pemilik template perlu mengetik ulang dalam sekali ketik.
export function findSplitTokens(documentXml, text) {
  const split = new Set();
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text || '')) !== null) {
    if (!String(documentXml).includes(m[0])) split.add(m[0]);
  }
  return [...split];
}
