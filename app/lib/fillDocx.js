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

export async function fillSuratDocx({ templateBytes, nama, nim, prodi, jabatan, tanggalTampil, nomorTampil, tandaTangan = 'basah', signatureBytes = null, outputType = 'blob' }) {
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

  // Tanda tangan digital: sisipkan PNG di blok tanda tangan — file media
  // baru + relationship baru + paragraf gambar sebelum paragraf nama
  // ("Hendryk Damastra" di blok tanda tangan = kemunculan terakhir).
  // Paragraf kosong di celah tanda tangan diganti gambarnya supaya tinggi
  // surat tidak bertambah (tetap 1 halaman).
  if (tandaTangan === 'digital' && signatureBytes) {
    const png = new Uint8Array(signatureBytes);
    // Dimensi PNG dari header (lebar/tinggi uint32 big-endian, byte 16/20).
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const pngW = view.getUint32(16);
    const pngH = view.getUint32(20);
    const H_PT = 58; // tinggi gambar
    const W_PT = H_PT * (pngW / pngH);
    const cx = Math.round(W_PT * 12700); // pt -> EMU
    const cy = Math.round(H_PT * 12700);
    zip.file('word/media/tanda-tangan.png', png);
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (!relsFile) throw new Error('word/_rels/document.xml.rels tidak ditemukan di template');
    let rels = await relsFile.async('string');
    let maxRid = 0;
    for (const m of rels.matchAll(/Id="rId(\d+)"/g)) maxRid = Math.max(maxRid, Number(m[1]));
    const rid = `rId${maxRid + 1}`;
    const rel = `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/tanda-tangan.png"/>`;
    rels = rels.replace('</Relationships>', rel + '</Relationships>');
    zip.file('word/_rels/document.xml.rels', rels);
    const drawing = `<w:p><w:pPr><w:pStyle w:val="style0"/><w:ind w:right="357"/><w:jc w:val="right"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Tanda tangan"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="tanda-tangan.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    const nameIdx = xml.lastIndexOf('<w:t>Hendryk Damastra</w:t>');
    if (nameIdx === -1) throw new Error('paragraf tanda tangan tidak ditemukan di template');
    const pStart = xml.lastIndexOf('<w:p>', nameIdx);
    if (pStart === -1) throw new Error('paragraf tanda tangan tidak ditemukan di template');
    const before = xml.slice(0, pStart);
    const gap = before.match(/(<w:p>(?:(?!<w:r>)[\s\S])*?<\/w:p>)+$/);
    const insertAt = gap ? pStart - gap[0].length : pStart;
    xml = xml.slice(0, insertAt) + drawing + xml.slice(pStart);
  }

  zip.file('word/document.xml', xml);
  // mimeType docx yang benar — tanpa ini JSZip memberi application/zip
  // dan unduhan di HP tersimpan/dibuka sebagai file .zip.
  return zip.generateAsync({ type: outputType, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
