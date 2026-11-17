// Mengisi template PDF surat (surat-template.pdf) dengan data penerima.
// Teknik: halaman template di-embed ke halaman A4 baru (diskalakan agar muat
// lebar A4, rata atas), lalu nilai lama ditutup kotak putih dan nilai baru
// digambar di atasnya dengan font Times New Roman 12pt (metrik sama dengan
// template). Baris "Program Studi" disisipkan di tabel penerima — semua isi
// di bawahnya (baris Jabatan/Organisasi, paragraf pernyataan, penutup,
// blok tanda tangan) digambar ulang bergeser 1 baris ke bawah.
// Koordinat diukur dari template via pdftotext -bbox (asal kiri-atas, pt).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4_W = 595.28;
const A4_H = 841.89;
const TPL_W = 612;
const TPL_H = 792;
const S = A4_W / TPL_W; // 0.9727 — template Letter diskalakan ke lebar A4
const FS = 12 * S; // ukuran font overlay, menyamai teks template yang ikut diskalakan

const X = (x) => x * S;
const Y = (yTop) => A4_H - yTop * S; // y-dari-atas -> y-dari-bawah (pdf-lib)
const BASE = (yMin) => A4_H - (yMin + 8) * S; // baseline dari yMin baris (font 12pt)

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

function wrapText(text, font, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(test, FS) <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function fillSuratPdf({ templateBytes, nama, nim, prodi, jabatan, tanggalTampil, nomorTampil, tandaTangan = 'basah', signatureBytes = null }) {
  const src = await PDFDocument.load(templateBytes);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.TimesRoman);
  const fontBold = await out.embedFont(StandardFonts.TimesRomanBold);
  const [embedded] = await out.embedPdf(templateBytes);
  const page = out.addPage([A4_W, A4_H]);
  page.drawPage(embedded, { x: 0, y: A4_H - TPL_H * S, width: TPL_W * S, height: TPL_H * S });

  const rect = (x0, y0, x1, y1) =>
    page.drawRectangle({ x: X(x0), y: Y(y1), width: (x1 - x0) * S, height: (y1 - y0) * S, color: WHITE });
  const text = (t, x, yMin, f = font, size = FS) =>
    page.drawText(t, { x: X(x), y: BASE(yMin), size, font: f, color: BLACK });
  const textRight = (t, rightX, yMin, f = font) => {
    const w = f.widthOfTextAtSize(t, FS);
    page.drawText(t, { x: X(rightX) - w, y: BASE(yMin), size: FS, font: f, color: BLACK });
  };

  // 1. Tanggal & nomor: tutup nilai lama, tulis yang baru
  rect(410, 141, 545, 158);
  textRight(tanggalTampil, 540.19, 144.49);
  rect(148.5, 167, 295, 184);
  text(nomorTampil, 150.53, 170.41);

  // 2. Tabel penerima: Nama & NIM (baris sudah ada di template)
  text(nama, 171.19, 412.16);
  text(nim, 171.19, 426.08);

  // 3. Sisip baris Program Studi: tutup semua dari baris Jabatan sampai akhir tanda tangan
  rect(68, 438, 545, 684);
  const ROW = 13.68; // jarak antar baris tabel
  // Label "Program Studi" lebih panjang dari label lain — digambar 11pt supaya
  // tidak menabrak titik dua di x=157.25 (label 12pt berakhir di ~156.6).
  text('Program Studi', 94.82, 439.76, font, 11 * S);
  text(':', 157.25, 439.76);
  text(prodi, 171.19, 439.76);
  text('Jabatan', 94.82, 439.76 + ROW);
  text(':', 157.25, 439.76 + ROW);
  text(jabatan, 171.19, 439.76 + ROW);
  text('Organisasi', 94.82, 439.76 + 2 * ROW);
  text(':', 157.25, 439.76 + 2 * ROW);
  text('Himpunan Mahasiswa Ilmu Komputer', 171.19, 439.76 + 2 * ROW);

  // 4. Paragraf pernyataan: tulis ulang dengan jabatan terpilih, geser 1 baris
  const sentence = `Adalah benar-benar mahasiswa yang aktif sebagai ${jabatan} Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya masa jabatan 2026/2027.`;
  const lines = wrapText(sentence, font, (540.19 - 72.02) * S);
  const PITCH = 15.84;
  lines.forEach((ln, i) => text(ln, 72.02, 483.7 + ROW + i * PITCH));

  // 5. Penutup, geser 1 baris
  text('Dengan demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya,', 72.02, 525.46 + ROW);

  // 6. Blok tanda tangan, geser 1 baris
  textRight('Ketua HIMA ILKOM', 540.31, 551.41 + ROW);
  textRight('Universitas Narotama Surabaya', 540.45, 567.25 + ROW);
  // Tanda tangan digital: tempel PNG di celah antara "Universitas..." dan
  // nama (baseline nama ~666, baseline "Universitas..." ~589 — ruang ~77pt).
  if (tandaTangan === 'digital' && signatureBytes) {
    try {
      const sig = await out.embedPng(signatureBytes);
      const SIG_H = 58; // tinggi gambar (pt template)
      const SIG_W = SIG_H * (sig.width / sig.height);
      const SIG_TOP = 594; // tepi atas gambar (koordinat dari-atas template)
      page.drawImage(sig, {
        x: X(540 - SIG_W),
        y: Y(SIG_TOP + SIG_H),
        width: SIG_W * S,
        height: SIG_H * S,
      });
    } catch { /* tanpa tanda tangan bila PNG gagal dimuat */ }
  }
  textRight('Hendryk Damastra', 540.12, 644.55 + ROW, fontBold);
  textRight('NIM : 04123008', 540.67, 670.23 + ROW);

  return await out.save();
}
