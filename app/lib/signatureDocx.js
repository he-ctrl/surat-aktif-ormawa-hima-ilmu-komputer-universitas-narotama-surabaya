// Penyisipan gambar tanda tangan ke dalam DOCX (dipakai fillDocx.js dan
// fillGenericDocx.js). Dua mode:
//  - inline: gambar di dalam alur paragraf (perilaku lama template bawaan).
//  - anchor: gambar mengambang pada posisi absolut halaman (posisi hasil
//    drag & drop di pratinjau, dalam persen terhadap halaman A4).
// Dimensi: tinggi 80pt, lebar ikut rasio PNG.

const A4_W_EMU = 7559970; // 210mm
const A4_H_EMU = 10691988; // 297mm

export function pngDimensions(png) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

// Tambah PNG sebagai media + relationship baru. Kembalikan { rid, cx, cy }
// (ukuran gambar dalam EMU, 1pt = 12700 EMU).
export async function addSignatureImage(zip, signatureBytes) {
  const png = new Uint8Array(signatureBytes);
  const { w: pngW, h: pngH } = pngDimensions(png);
  const H_PT = 80;
  const W_PT = H_PT * (pngW / pngH);
  const cx = Math.round(W_PT * 12700);
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
  return { rid, cx, cy };
}

function graphicXml(rid, cx, cy) {
  return `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="tanda-tangan.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`;
}

// Paragraf gambar inline, rata kanan (dipakai template bawaan bila posisi
// tanda tangan tidak digeser).
export function inlineDrawingParagraph({ rid, cx, cy }) {
  return `<w:p><w:pPr><w:pStyle w:val="style0"/><w:ind w:right="357"/><w:jc w:val="right"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Tanda tangan"/><wp:cNvGraphicFramePr/>${graphicXml(rid, cx, cy)}</wp:inline></w:drawing></w:r></w:p>`;
}

// Paragraf gambar mengambang (wp:anchor) pada posisi persen halaman A4.
// sigPos: { x, y } dalam persen (0-100) dari tepi kiri/atas halaman.
export function anchorDrawingParagraph({ rid, cx, cy, sigPos }) {
  const xEmu = Math.round((Math.min(96, Math.max(0, sigPos.x)) / 100) * A4_W_EMU);
  const yEmu = Math.round((Math.min(96, Math.max(0, sigPos.y)) / 100) * A4_H_EMU);
  return `<w:p><w:pPr><w:jc w:val="left"/><w:rPr/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${xEmu}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${yEmu}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="Tanda tangan"/><wp:cNvGraphicFramePr/>${graphicXml(rid, cx, cy)}</wp:anchor></w:drawing></w:r></w:p>`;
}
