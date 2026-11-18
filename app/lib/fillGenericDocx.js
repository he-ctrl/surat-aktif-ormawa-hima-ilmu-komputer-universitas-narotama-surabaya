// Isi template DOCX kustom (yang diunggah owner) di browser.
// Semua token {parameter | tipe | opsi} dan {{parameter}} diganti dengan
// nilai dari form; {tanggal} dan {nomor} diisi otomatis. Sisanya di dalam
// dokumen (kop, logo, layout) tidak berubah.
// Bila ada token yang masih tersisa setelah penggantian, berarti placeholder
// di template terpotong ke beberapa run Word — unduhan dibatalkan dengan
// pesan yang jelas, supaya tidak ada surat yang keluar dengan {nama} mentah.
import JSZip from 'jszip';
import { extractDocxText, parsePlaceholders } from './parseTemplate.js';
import { addSignatureImage, anchorDrawingParagraph } from './signatureDocx.js';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const TOKEN_RE = /\{\{([^{}]+)\}\}|\{([^{}]+)\}/g;

export async function fillGenericDocx({ templateBytes, values, tandaTangan = 'basah', signatureBytes = null, sigPos = null, outputType = 'blob' }) {
  const zip = await JSZip.loadAsync(templateBytes);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml tidak ditemukan di template');
  let xml = await file.async('string');
  // Normalisasi kunci nilai ke huruf kecil — nama parameter di template
  // bisa ditulis "Nama" atau "nama", keduanya harus cocok.
  const norm = {};
  for (const [k, v] of Object.entries(values || {})) norm[String(k).toLowerCase()] = v;
  const valuesByName = norm;

  xml = xml.replace(TOKEN_RE, (match, g1, g2) => {
    const inner = (g1 ?? g2).trim();
    // Token yang terpotong tag XML (<w:t> di tengah) — jangan dirusak,
    // nanti dilaporkan sebagai token tersisa.
    if (inner.includes('<')) return match;
    const name = inner.split('|')[0].trim().toLowerCase();
    const v = valuesByName[name];
    if (v === undefined || v === null || String(v).trim() === '') return '';
    return escapeXml(String(v));
  });

  // Token tersisa = placeholder terpotong run di template aslinya.
  const leftover = extractDocxText(xml).match(TOKEN_RE);
  if (leftover && leftover.length > 0) {
    const unik = [...new Set(leftover)].slice(0, 3).join(', ');
    throw new Error(`Placeholder masih tersisa di template (${unik}) — kemungkinan placeholder terpotong saat diketik di Word. Ketik ulang placeholder dalam sekali ketik tanpa mengedit di tengah kata, lalu unggah ulang template.`);
  }

  // Tanda tangan digital: gambar mengambang (anchor) pada posisi hasil
  // drag & drop di pratinjau (persen terhadap halaman A4).
  if (tandaTangan === 'digital' && signatureBytes) {
    const { rid, cx, cy } = await addSignatureImage(zip, signatureBytes);
    const pos = sigPos || { x: 68, y: 80 };
    const anchor = anchorDrawingParagraph({ rid, cx, cy, sigPos: pos });
    if (!xml.includes('</w:body>')) throw new Error('struktur template tidak dikenali (</w:body> tidak ada)');
    xml = xml.replace('</w:body>', anchor + '</w:body>');
  }

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: outputType, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
