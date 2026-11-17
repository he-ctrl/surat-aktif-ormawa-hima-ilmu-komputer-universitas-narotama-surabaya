// Fill the original .docx template (surat-template.docx) in the browser.
// The template already carries the kop (header + 2 logos), fonts and layout;
// this only swaps the {{placeholders}} inline inside word/document.xml,
// so nothing else in the document changes. Page size is A4 in the template.
import JSZip from 'jszip';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function fillSuratDocx({ templateBytes, nama, nim, prodi, jabatan, tanggalTampil, nomorTampil, outputType = 'blob' }) {
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
  zip.file('word/document.xml', xml);
  // mimeType docx yang benar — tanpa ini JSZip memberi application/zip
  // dan unduhan di HP tersimpan/dibuka sebagai file .zip.
  return zip.generateAsync({ type: outputType, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
