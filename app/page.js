'use client';

import { useEffect, useRef, useState } from 'react';

const JABATAN_OPTIONS = ['Sekretaris', 'Bendahara', 'Dokumentasi', 'Humas'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const PENANDATANGAN = { nama: 'Hendryk Damastra', nim: '04123008', jabatan: 'Ketua', organisasi: 'Himpunan Mahasiswa Ilmu Komputer' };

const PATH_PREFIX = '/surat-aktif-ormawa-hima-ilmu-komputer-universitas-narotama-surabaya';
const ASSET_BASE = 'https://surat-aktif-ormawa-hima-ilmu-komput.vercel.app';
// Aset di public/ diambil lewat path yang sama dengan halaman, supaya tetap
// jalan baik di domain vercel.app maupun lewat rewrite hendrykdamastra.my.id.
function assetPath(p) {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith(PATH_PREFIX)) return PATH_PREFIX + p;
  return p;
}

async function fetchLogoRun(path, ImageRun) {
  try {
    const r = await fetch(assetPath(path));
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return new ImageRun({ data: buf, transformation: { width: 93, height: 93 } });
  } catch {
    return null;
  }
}

function formatTanggal(d) {
  return `Surabaya, ${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatNomor(d) {
  return `01/HIMAILKOM/${d.getDate()}/${BULAN_ROMAWI[d.getMonth()]}/${d.getFullYear()}`;
}

function slug(s) {
  return (s || 'surat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'surat';
}

export default function Page() {
  const [nama, setNama] = useState('');
  const [nim, setNim] = useState('');
  const [prodi, setProdi] = useState('Ilmu Komputer');
  const [jabatan, setJabatan] = useState('Sekretaris');
  const [submitted, setSubmitted] = useState(null); // { tanggal: string, nomor: string }
  const [busy, setBusy] = useState('');
  const [records, setRecords] = useState([]); // nama yang pernah dibuat (dari database)
  const [showSaran, setShowSaran] = useState(false);
  const letterRef = useRef(null);

  // Ambil daftar nama yang sudah pernah dibuat dari database.
  useEffect(() => {
    fetch('/api/names')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.records)) setRecords(d.records); })
      .catch(() => {});
  }, []);

  // Saran nama yang cocok dengan ketikan (maks. 6).
  const saran = records.filter((r) => {
    const q = nama.trim().toLowerCase();
    if (!q) return false;
    return r.nama.toLowerCase().includes(q) && r.nama.toLowerCase() !== q;
  }).slice(0, 6);

  // Pilih saran: isi otomatis NIM, prodi, dan jabatan.
  function pilihSaran(r) {
    setNama(r.nama);
    setNim(r.nim || '');
    setProdi(r.prodi || 'Ilmu Komputer');
    if (r.jabatan && JABATAN_OPTIONS.includes(r.jabatan)) setJabatan(r.jabatan);
    setShowSaran(false);
  }

  const now = new Date();
  const tanggalTampil = submitted ? submitted.tanggal : formatTanggal(now);
  const nomorTampil = submitted ? submitted.nomor : formatNomor(now);
  const bisaSubmit = nama.trim() !== '' && nim.trim() !== '';

  function handleSubmit(e) {
    e.preventDefault();
    if (!bisaSubmit) return;
    const d = new Date();
    setSubmitted({ tanggal: formatTanggal(d), nomor: formatNomor(d) });
    // Simpan nama ke database supaya muncul sebagai saran berikutnya.
    fetch('/api/names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim(), nim: nim.trim(), prodi: prodi.trim(), jabatan }),
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.records)) setRecords(data.records); })
      .catch(() => {});
    setTimeout(() => letterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function handleReset() {
    setNama('');
    setNim('');
    setProdi('Ilmu Komputer');
    setJabatan('Sekretaris');
    setSubmitted(null);
  }

  function handlePrint() {
    window.print();
  }

  async function handlePdf() {
    if (!submitted) return;
    setBusy('pdf');
    try {
      // Isi template PDF asli (dengan kop + logo) lewat pdf-lib — hasilnya A4.
      const { fillSuratPdf } = await import('./lib/fillPdf.js');
      const res = await fetch(assetPath('/surat-template.pdf'));
      if (!res.ok) throw new Error('template tidak ditemukan');
      const templateBytes = await res.arrayBuffer();
      const bytes = await fillSuratPdf({
        templateBytes,
        nama: nama.trim(),
        nim: nim.trim(),
        prodi: prodi.trim(),
        jabatan,
        tanggalTampil,
        nomorTampil,
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Surat-Aktif-Ormawa-${slug(nama)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Fallback bila template tidak bisa dimuat: render pratinjau HTML seperti sebelumnya.
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        await html2pdf().set({
          margin: [10, 12, 10, 12],
          filename: `Surat-Aktif-Ormawa-${slug(nama)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        }).from(letterRef.current).save();
      } catch { /* abaikan */ }
    } finally {
      setBusy('');
    }
  }

  async function handleDocx() {
    if (!submitted) return;
    setBusy('docx');
    try {
      // Isi template docx asli (kop + 2 logo + layout asli, ukuran A4):
      // hanya placeholder {{...}} yang diganti, sisanya tidak berubah.
      const { fillSuratDocx } = await import('./lib/fillDocx.js');
      const res = await fetch(assetPath('/surat-template.docx'));
      if (!res.ok) throw new Error('template tidak ditemukan');
      const blob = await fillSuratDocx({
        templateBytes: await res.arrayBuffer(),
        nama: nama.trim(),
        nim: nim.trim(),
        prodi: prodi.trim(),
        jabatan,
        tanggalTampil,
        nomorTampil,
      });
      downloadBlob(blob, `Surat-Aktif-Ormawa-${slug(nama)}.docx`);
      return;
    } catch {
      // Fallback bila template tidak bisa dimuat: bangun docx dari nol (dengan kop logo).
      try {
        const blob = await buildDocxFallback();
        downloadBlob(blob, `Surat-Aktif-Ormawa-${slug(nama)}.docx`);
      } catch { /* abaikan */ }
    } finally {
      setBusy('');
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function buildDocxFallback() {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ImageRun } = await import('docx');

      // Logo kop dari template asli (70pt, sama seperti di docx template).
      const logoNarotama = await fetchLogoRun('/logo-narotama.png', ImageRun);
      const logoHima = await fetchLogoRun('/logo-himailkom.png', ImageRun);

      const font = 'Times New Roman';
      const size = 24; // 12pt
      const run = (text, opts = {}) => new TextRun({ text, font, size, ...opts });
      const para = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 120 }, ...opts });
      const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
      const cell = (text, bold = false) => new TableCell({ children: [new Paragraph({ children: [run(text, { bold })], spacing: { after: 0 } })], borders: noBorders });
      const idRow = (label, value) => new TableRow({
        children: [
          new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: [new Paragraph({ children: [run(label)], spacing: { after: 0 } })], borders: noBorders }),
          new TableCell({ width: { size: 300, type: WidthType.DXA }, children: [new Paragraph({ children: [run(':')], spacing: { after: 0 } })], borders: noBorders }),
          new TableCell({ children: [new Paragraph({ children: [run(value)], spacing: { after: 0 } })], borders: noBorders }),
        ],
      });
      const idTable = (rows) => new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders });

      const kopTable = new Table({
        rows: [new TableRow({
          children: [
            new TableCell({ width: { size: 1400, type: WidthType.DXA }, children: [new Paragraph({ children: logoNarotama ? [logoNarotama] : [], alignment: AlignmentType.CENTER, spacing: { after: 0 } })], borders: noBorders }),
            new TableCell({ width: { size: 6560, type: WidthType.DXA }, children: [
              para(run('HIMPUNAN MAHASISWA ILMU KOMPUTER (HIMA ILKOM)', { bold: true, size: 28 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
              para(run('UNIVERSITAS NAROTAMA SURABAYA', { bold: true, size: 26 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
              para(run('Alamat : Jl. Arief Rahman Hakim No. 51 Surabaya', { size: 22 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
              para(run('Email : hima.ilmukomputer@narotama.ac.id', { size: 22, color: '0563C1', underline: {} }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
            ], borders: noBorders }),
            new TableCell({ width: { size: 1400, type: WidthType.DXA }, children: [new Paragraph({ children: logoHima ? [logoHima] : [], alignment: AlignmentType.CENTER, spacing: { after: 0 } })], borders: noBorders }),
          ],
        })],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...noBorders, bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000' } },
      });

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            kopTable,
            para(run(''), { spacing: { after: 240 } }),
            para(run(tanggalTampil), { alignment: AlignmentType.RIGHT, spacing: { after: 60 } }),
            idTable([idRow('Nomor', nomorTampil), idRow('Lampiran', '-'), idRow('Perihal', 'Surat Pemberitahuan')]),
            para(run('SURAT KETERANGAN AKTIF ORGANISASI', { bold: true, size: 28, underline: {} }), { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 240 } }),
            para(run('Yang bertanda tangan di bawah ini :'), { spacing: { after: 60 } }),
            idTable([
              idRow('Nama', PENANDATANGAN.nama),
              idRow('NIM', PENANDATANGAN.nim),
              idRow('Jabatan', PENANDATANGAN.jabatan),
              idRow('Organisasi', PENANDATANGAN.organisasi),
            ]),
            para(run('Menyatakan dengan sesungguhnya bahwa :'), { spacing: { before: 120, after: 60 } }),
            idTable([
              idRow('Nama', nama.trim()),
              idRow('NIM', nim.trim()),
              idRow('Program Studi', prodi.trim()),
              idRow('Jabatan', jabatan),
              idRow('Organisasi', PENANDATANGAN.organisasi),
            ]),
            para(run(`Adalah benar-benar mahasiswa yang aktif sebagai ${jabatan} Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya masa jabatan 2026/2027.`), { alignment: AlignmentType.JUSTIFIED, spacing: { before: 120, after: 120 } }),
            para(run('Dengan demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya,'), { alignment: AlignmentType.JUSTIFIED, spacing: { after: 240 } }),
            para(run('Ketua HIMA ILKOM'), { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
            para(run('Universitas Narotama Surabaya'), { alignment: AlignmentType.RIGHT, spacing: { after: 720 } }),
            para(run('Hendryk Damastra', { bold: true }), { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
            para(run('NIM : 04123008'), { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
          ],
        }],
      });

      return Packer.toBlob(doc);
  }

  const tampil = (v) => (v && v.trim() !== '' ? v : '........');

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <img className="topbar-logo" src={`${ASSET_BASE}/logo-himailkom.png`} alt="Logo HIMA ILKOM" />
          <div>
            <h1>Surat Keterangan Aktif Organisasi</h1>
            <p>Himpunan Mahasiswa Ilmu Komputer (HIMA ILKOM) — Universitas Narotama Surabaya</p>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="layout">
          <section className="panel">
            <h2>Isi Data Penerima Surat</h2>
            <p className="hint">Isi data di bawah ini, lalu tekan Buat Surat. Tanggal dan nomor surat dibuat otomatis mengikuti waktu kamu menekan tombol tersebut.</p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="nama">Nama <span>*</span></label>
                <div className="saran-wrap">
                  <input id="nama" type="text" value={nama} autoComplete="off"
                    onChange={(e) => { setNama(e.target.value); setShowSaran(true); }}
                    onFocus={() => setShowSaran(true)}
                    onBlur={() => setTimeout(() => setShowSaran(false), 150)}
                    placeholder="Nama lengkap" required />
                  {showSaran && saran.length > 0 && (
                    <ul className="saran-list">
                      {saran.map((r) => (
                        <li key={r.nama}>
                          <button type="button" onMouseDown={(ev) => { ev.preventDefault(); pilihSaran(r); }}>
                            <b>{r.nama}</b>
                            <span>{[r.nim, r.jabatan].filter(Boolean).join(' • ')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="help">Ketik nama — bila pernah dibuat sebelumnya, pilih dari saran dan NIM, prodi, serta jabatan terisi otomatis.</div>
              </div>
              <div className="field">
                <label htmlFor="nim">NIM <span>*</span></label>
                <input id="nim" type="text" value={nim} onChange={(e) => setNim(e.target.value)} placeholder="Contoh: 04123006" required />
              </div>
              <div className="field">
                <label htmlFor="prodi">Program Studi</label>
                <input id="prodi" type="text" value={prodi} onChange={(e) => setProdi(e.target.value)} placeholder="Ilmu Komputer" />
                <div className="help">Bawaan: Ilmu Komputer. Ubah bila perlu.</div>
              </div>
              <div className="field">
                <label htmlFor="jabatan">Jabatan</label>
                <select id="jabatan" value={jabatan} onChange={(e) => setJabatan(e.target.value)}>
                  {JABATAN_OPTIONS.map((j) => (<option key={j} value={j}>{j}</option>))}
                </select>
                <div className="help">Jabatan ini muncul di bagian &ldquo;Menyatakan dengan sesungguhnya bahwa&rdquo; dan di kalimat pernyataan surat.</div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={!bisaSubmit}>Buat Surat</button>
              {submitted && (<button className="btn-ghost" type="button" onClick={handleReset}>Buat surat baru (reset)</button>)}
            </form>

            <div className="meta">
              <b>Penandatangan (tetap):</b><br />
              Hendryk Damastra — NIM 04123008<br />
              Ketua Himpunan Mahasiswa Ilmu Komputer
            </div>

            {records.length > 0 && (
              <div className="history">
                <b>Nama yang sudah pernah dibuat:</b>
                <div className="chips">
                  {records.map((r) => (
                    <button key={r.nama} type="button" className="chip" onClick={() => pilihSaran(r)} title={`${r.nama}${r.nim ? ' — ' + r.nim : ''}${r.jabatan ? ' — ' + r.jabatan : ''}`}>{r.nama}</button>
                  ))}
                </div>
                <div className="help">Ketuk nama untuk mengisi otomatis NIM, prodi, dan jabatan.</div>
              </div>
            )}
          </section>

          <section className="letter-wrap">
            <div className="letter" ref={letterRef}>
              <div className="kop">
                <div className="kop-logos">
                  <img src={`${ASSET_BASE}/logo-narotama.png`} alt="Logo Universitas Narotama" />
                  <div className="kop-text">
                    <div className="org">HIMPUNAN MAHASISWA ILMU KOMPUTER (HIMA ILKOM)</div>
                    <div className="univ">UNIVERSITAS NAROTAMA SURABAYA</div>
                    <div className="addr">Alamat : Jl. Arief Rahman Hakim No. 51 Surabaya</div>
                    <div className="addr email">Email : hima.ilmukomputer@narotama.ac.id</div>
                  </div>
                  <img src={`${ASSET_BASE}/logo-himailkom.png`} alt="Logo HIMA ILKOM" />
                </div>
              </div>

              <div className="date-line">{tanggalTampil}</div>
              <div className="head-lines">
                <div><span className="k">Nomor</span><span>: {nomorTampil}</span></div>
                <div><span className="k">Lampiran</span><span>: -</span></div>
                <div><span className="k">Perihal</span><span>: Surat Pemberitahuan</span></div>
              </div>

              <div className="letter-title">SURAT KETERANGAN AKTIF ORGANISASI</div>

              <p>Yang bertanda tangan di bawah ini :</p>
              <table className="idtable"><tbody>
                <tr><td className="lbl">Nama</td><td className="sep">:</td><td>{PENANDATANGAN.nama}</td></tr>
                <tr><td className="lbl">NIM</td><td className="sep">:</td><td>{PENANDATANGAN.nim}</td></tr>
                <tr><td className="lbl">Jabatan</td><td className="sep">:</td><td>{PENANDATANGAN.jabatan}</td></tr>
                <tr><td className="lbl">Organisasi</td><td className="sep">:</td><td>{PENANDATANGAN.organisasi}</td></tr>
              </tbody></table>

              <p>Menyatakan dengan sesungguhnya bahwa :</p>
              <table className="idtable"><tbody>
                <tr><td className="lbl">Nama</td><td className="sep">:</td><td className={nama.trim() ? '' : 'placeholder'}>{tampil(nama)}</td></tr>
                <tr><td className="lbl">NIM</td><td className="sep">:</td><td className={nim.trim() ? '' : 'placeholder'}>{tampil(nim)}</td></tr>
                <tr><td className="lbl">Program Studi</td><td className="sep">:</td><td className={prodi.trim() ? '' : 'placeholder'}>{tampil(prodi)}</td></tr>
                <tr><td className="lbl">Jabatan</td><td className="sep">:</td><td>{jabatan}</td></tr>
                <tr><td className="lbl">Organisasi</td><td className="sep">:</td><td>{PENANDATANGAN.organisasi}</td></tr>
              </tbody></table>

              <p>Adalah benar-benar mahasiswa yang aktif sebagai {jabatan} Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya masa jabatan 2026/2027.</p>
              <p>Dengan demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya,</p>

              <div className="sign">
                <div>Ketua HIMA ILKOM</div>
                <div>Universitas Narotama Surabaya</div>
                <div className="name">Hendryk Damastra</div>
                <div>NIM : 04123008</div>
              </div>
            </div>

            <div className="actions no-print">
              <button className="btn btn-outline" type="button" onClick={handlePrint} disabled={!submitted}>Cetak</button>
              <button className="btn btn-outline" type="button" onClick={handlePdf} disabled={!submitted || busy !== ''}>{busy === 'pdf' ? 'Membuat PDF…' : 'Unduh PDF'}</button>
              <button className="btn btn-outline" type="button" onClick={handleDocx} disabled={!submitted || busy !== ''}>{busy === 'docx' ? 'Membuat DOCX…' : 'Unduh DOCX'}</button>
            </div>
            {!submitted && (<p className="hint no-print" style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Tombol Cetak / PDF / DOCX aktif setelah kamu menekan Buat Surat.</p>)}
            {submitted && (
              <div className="meta no-print">
                Surat dibuat dengan nomor <b>{submitted.nomor}</b> pada <b>{submitted.tanggal}</b>. Mengubah isian di kiri akan memperbarui isi surat, tetapi nomor dan tanggal tetap seperti saat pertama dibuat.
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="footer">
        HIMA ILKOM Universitas Narotama Surabaya — Jl. Arief Rahman Hakim No. 51 Surabaya
      </footer>
    </>
  );
}
