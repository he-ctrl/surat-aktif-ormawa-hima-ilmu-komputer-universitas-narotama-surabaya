// Format nomor surat yang bisa diatur owner (Dasbor Owner).
// Placeholder waktu (diisi dari tanggal surat dibuat):
//   {waktu.tanggal}      — tanggal, 1-31 (mis. 18)
//   {waktu.bulan}        — bulan angka, 1-12 (mis. 11)
//   {waktu.tahun}        — tahun (mis. 2026)
//   {waktu.bulan.romawi} — bulan Romawi (I-XII, mis. XI)
// Selain itu format adalah teks bebas, mis. "01/HIMAILKOM/...".

const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const DEFAULT_NOMOR_FORMAT = '01/HIMAILKOM/{waktu.tanggal}/{waktu.bulan.romawi}/{waktu.tahun}';
export const NOMOR_PLACEHOLDERS = ['{waktu.tanggal}', '{waktu.bulan}', '{waktu.tahun}', '{waktu.bulan.romawi}'];

export function waktuValues(d) {
  return {
    'waktu.tanggal': String(d.getDate()),
    'waktu.bulan': String(d.getMonth() + 1),
    'waktu.tahun': String(d.getFullYear()),
    'waktu.bulan.romawi': BULAN_ROMAWI[d.getMonth()],
  };
}

export function formatNomor(d, format) {
  const f = (format && format.trim()) || DEFAULT_NOMOR_FORMAT;
  const wv = waktuValues(d);
  return f.replace(/\{waktu\.(tanggal|bulan\.romawi|bulan|tahun)\}/g, (m) => wv[m.slice(1, -1)] ?? m);
}

export function validateNomorFormat(format) {
  if (typeof format !== 'string' || !format.trim()) return 'Format nomor tidak boleh kosong.';
  if (format.length > 120) return 'Format nomor maksimal 120 karakter.';
  const unknown = [...format.matchAll(/\{[^}]*\}/g)]
    .map((m) => m[0])
    .filter((t) => !NOMOR_PLACEHOLDERS.includes(t));
  if (unknown.length > 0) {
    return `Placeholder tidak dikenal: ${unknown.join(', ')}. Yang bisa dipakai: ${NOMOR_PLACEHOLDERS.join(', ')}.`;
  }
  return null;
}
