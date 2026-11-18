// Fill the original .docx template (surat-template.docx) in the browser.
// The template already carries the kop (header + 2 logos), fonts and layout;
// this only swaps the {{placeholders}} inline inside word/document.xml,
// so nothing else in the document changes. Page size is A4 in the template.
// Tanda tangan digital: tanpa drag -> gambar inline di blok tanda tangan
// (perilaku lama, surat tetap 1 halaman); bila posisi digeser lewat
// drag & drop di pratinjau (sigPos {x, y} persen halaman) -> gambar
// mengambang (wp:anchor) pada posisi tersebut.
import JSZip from 'jszip';
import { addSignatureImage, inlineDrawingParagraph, anchorDrawingParagraph } from './signatureDocx.js';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function fillSuratDocx({ templateBytes, nama, nim, prodi, jabatan, tanggalTampil, nomorTampil, tandaTangan = 'basah', signatureBytes = null, sigPos = null, outputType = 'blob' }) {
  const zip = await JSZip.loadAsync(templateBytes);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml tidak ditemukan di template');
  let xml = await file.async('string');
  const values = {
    tanggal: tanggalTampil,
    nomor: nomorTampil,
    nama: nama.trim(),
    nim: nim.trim(),
    prodi: prodi.trim(),
    jabatan,
  };
  for (const [key, value] of Object.entries(values)) {
    const ph = `{{${key}}}`;
    if (!xml.includes(ph)) throw new Error(`placeholder ${ph} tidak ada di template`);
    xml = xml.split(ph).join(escapeXml(value));
  }
  if (xml.includes('{{')) throw new Error('masih ada placeholder yang belum terisi');

  if (tandaTangan === 'digital' && signatureBytes) {
    const { rid, cx, cy } = await addSignatureImage(zip, signatureBytes);
    if (sigPos) {
      // Posisi hasil drag & drop: gambar mengambang absolut di halaman.
      const anchor = anchorDrawingParagraph({ rid, cx, cy, sigPos });
      if (!xml.includes('</w:body>')) throw new Error('struktur template tidak dikenali (</w:body> tidak ada)');
      // <w:sectPr> harus tetap jadi anak terakhir <w:body> — sisipkan
      // paragraf anchor SEBELUM sectPr terakhir (bukan setelahnya).
      // Sisip setelah sectPr membuat header/footer (kop) hilang di
      // docx-preview dan di hasil unduhan.
      const sectIdx = xml.lastIndexOf('<w:sectPr');
      if (sectIdx !== -1) xml = xml.slice(0, sectIdx) + anchor + xml.slice(sectIdx);
      else xml = xml.replace('</w:body>', anchor + '</w:body>');
    } else {
      // Perilaku lama: gambar inline sebelum paragraf nama ("Hendryk
      // Damastra" di blok tanda tangan = kemunculan terakhir). Paragraf
      // kosong di celah tanda tangan diganti gambarnya supaya tinggi surat
      // tidak bertambah (tetap 1 halaman).
      const drawing = inlineDrawingParagraph({ rid, cx, cy });
      const nameIdx = xml.lastIndexOf('<w:t>Hendryk Damastra</w:t>');
      if (nameIdx === -1) throw new Error('paragraf tanda tangan tidak ditemukan di template');
      const pStart = xml.lastIndexOf('<w:p>', nameIdx);
      if (pStart === -1) throw new Error('paragraf tanda tangan tidak ditemukan di template');
      const before = xml.slice(0, pStart);
      const gap = before.match(/(<w:p>(?:(?!<w:r>)[\s\S])*?<\/w:p>)+$/);
      const insertAt = gap ? pStart - gap[0].length : pStart;
      xml = xml.slice(0, insertAt) + drawing + xml.slice(pStart);
    }
  }

  zip.file('word/document.xml', xml);
  // mimeType docx yang benar — tanpa ini JSZip memberi application/zip
  // dan unduhan di HP tersimpan/dibuka sebagai file .zip.
  return zip.generateAsync({ type: outputType, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
