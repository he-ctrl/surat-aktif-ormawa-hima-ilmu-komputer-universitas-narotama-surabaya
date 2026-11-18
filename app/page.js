'use client';

import { useEffect, useRef, useState } from 'react';
import { BUILTIN_TEMPLATE, PRODI_OPTIONS, JABATAN_OPTIONS } from './lib/builtinTemplate.js';
import { formatNomor, DEFAULT_NOMOR_FORMAT, NOMOR_PLACEHOLDERS } from './lib/nomorFormat.js';

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PENANDATANGAN = { nama: 'Hendryk Damastra', nim: '04123008', jabatan: 'Ketua', organisasi: 'Himpunan Mahasiswa Ilmu Komputer' };

// Halaman bisa disajikan di tiga tempat: root domain vercel.app (tanpa prefix),
// subpath panjang di hendrykdamastra.my.id, atau alias pendek /surat di domain
// yang sama. Aset dan panggilan API memakai prefix yang sama dengan halaman,
// supaya tetap jalan di ketiganya (hanya path itu yang di-rewrite ke aplikasi
// surat; /api/... di root domain justru mengenai situs personal → 404 HTML).
const PATH_PREFIXES = ['/surat-aktif-ormawa-hima-ilmu-komputer-universitas-narotama-surabaya', '/surat'];
const ASSET_BASE = 'https://surat-aktif-ormawa-hima-ilmu-komput.vercel.app';
function basePrefix() {
  if (typeof window === 'undefined') return '';
  const p = window.location.pathname;
  for (const pre of PATH_PREFIXES) if (p === pre || p.startsWith(pre + '/')) return pre;
  return '';
}
function assetPath(p) {
  const pre = basePrefix();
  return pre ? pre + p : p;
}
function apiPath(p) {
  const pre = basePrefix();
  return pre ? pre + p : p;
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

function slug(s) {
  return (s || 'surat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'surat';
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEFAULT_SIG_POS = { x: 68, y: 80 }; // posisi awal tanda tangan (kustom)

function defaultValuesFor(t) {
  const v = {};
  for (const p of t.params || []) {
    if (p.type === 'dropdown' || p.type === 'radio') v[p.name] = p.options?.[0] || '';
    else v[p.name] = '';
  }
  return v;
}

export default function Page() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(null); // { tanggal: string, nomor: string }
  const [busy, setBusy] = useState('');
  const [records, setRecords] = useState([]); // nama yang pernah dibuat (dari database)
  const [showSaran, setShowSaran] = useState(false);
  const [tandaTangan, setTandaTangan] = useState('digital'); // 'digital' | 'basah'
  const [sigMode, setSigMode] = useState('inline'); // 'inline' | 'overlay' (bawaan)
  const [sigPos, setSigPos] = useState(null); // { x, y } persen — posisi tanda tangan hasil drag
  const [sigDragged, setSigDragged] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [customBytes, setCustomBytes] = useState(null); // bytes DOCX template kustom terpilih
  const [customHtml, setCustomHtml] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');

  // Owner
  const [owner, setOwner] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [sigVersion, setSigVersion] = useState(0); // pengubah cache URL tanda tangan
  const [sigBusy, setSigBusy] = useState(false);
  const [sigMsg, setSigMsg] = useState('');
  const [sigError, setSigError] = useState('');
  const [nomorFormat, setNomorFormat] = useState(DEFAULT_NOMOR_FORMAT);
  const [nomorInput, setNomorInput] = useState(DEFAULT_NOMOR_FORMAT);
  const [nomorBusy, setNomorBusy] = useState(false);
  const [nomorMsg, setNomorMsg] = useState('');
  const [nomorError, setNomorError] = useState('');

  const letterRef = useRef(null);
  const sigImgRef = useRef(null);
  const fileInputRef = useRef(null);
  const sigFileRef = useRef(null);
  const bytesCache = useRef(new Map());

  const selected = templates.find((t) => t.id === selectedId) || templates[0] || null;
  const isCustom = selected?.kind === 'custom';
  const sigUrl = `${apiPath('/api/signature')}?v=${sigVersion}`;

  async function refreshTemplates(selectId) {
    try {
      const d = await (await fetch(apiPath('/api/templates'))).json();
      if (Array.isArray(d.templates) && d.templates.length > 0) {
        setTemplates(d.templates);
        const pick = d.templates.find((t) => t.id === selectId)
          || d.templates.find((t) => t.isDefault)
          || d.templates[0];
        setSelectedId(pick.id);
        setValues((prev) => (Object.keys(prev).length === 0 || selectId ? defaultValuesFor(pick) : prev));
        return d.templates;
      }
    } catch { /* tetap pakai template bawaan bila API gagal */ }
    setTemplates([BUILTIN_TEMPLATE]);
    setSelectedId(BUILTIN_TEMPLATE.id);
    setValues(defaultValuesFor(BUILTIN_TEMPLATE));
    return [BUILTIN_TEMPLATE];
  }

  // Muat template, nama tersimpan, dan status login owner.
  useEffect(() => {
    refreshTemplates();
    fetch(apiPath('/api/names'))
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.records)) setRecords(d.records); })
      .catch(() => {});
    fetch(apiPath('/api/auth'))
      .then((r) => r.json())
      .then((d) => { if (d.user) setOwner(d.user); })
      .catch(() => {});
    fetch(apiPath('/api/settings'))
      .then((r) => r.json())
      .then((d) => { if (d.nomorFormat) { setNomorFormat(d.nomorFormat); setNomorInput(d.nomorFormat); } })
      .catch(() => {});
  }, []);

  // Ambil bytes DOCX template kustom terpilih (untuk pratinjau + unduhan).
  useEffect(() => {
    if (!selected || selected.kind !== 'custom') { setCustomBytes(null); setCustomHtml(''); setCustomError(''); return; }
    if (bytesCache.current.has(selected.id)) { setCustomBytes(bytesCache.current.get(selected.id)); return; }
    let cancelled = false;
    setCustomLoading(true);
    fetch(apiPath(`/api/template-file/${selected.id}`))
      .then((r) => { if (!r.ok) throw new Error('file template tidak ditemukan'); return r.arrayBuffer(); })
      .then((bytes) => {
        if (cancelled) return;
        bytesCache.current.set(selected.id, bytes);
        setCustomBytes(bytes);
        setCustomLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCustomLoading(false);
        setCustomError('File template tidak bisa dimuat.');
      });
    return () => { cancelled = true; };
  }, [selected?.id]);

  const now = new Date();
  const tanggalTampil = submitted ? submitted.tanggal : formatTanggal(now);
  const nomorTampil = submitted ? submitted.nomor : formatNomor(now, nomorFormat);

  // Pratinjau template kustom: isi DOCX dengan nilai form, lalu render
  // ke HTML lewat mammoth (debounce 400ms supaya mengetik tetap ringan).
  // Isian kosong ditampilkan sebagai '........' di pratinjau saja.
  useEffect(() => {
    if (!selected || selected.kind !== 'custom' || !customBytes) return;
    const t = setTimeout(async () => {
      try {
        const { fillGenericDocx } = await import('./lib/fillGenericDocx.js');
        const previewValues = { tanggal: tanggalTampil, nomor: nomorTampil };
        for (const p of selected.params || []) {
          const v = (values[p.name] || '').trim();
          previewValues[p.name] = v !== '' ? values[p.name] : '........';
        }
        const filled = await fillGenericDocx({
          templateBytes: customBytes, values: previewValues, tandaTangan: 'basah', outputType: 'arraybuffer',
        });
        const mammoth = (await import('mammoth')).default;
        const { value } = await mammoth.convertToHtml({ arrayBuffer: filled }, {
          convertImage: mammoth.images.imgElement((image) =>
            image.read('base64').then((b64) => ({ src: `data:${image.contentType};base64,${b64}` }))),
        });
        setCustomHtml(value);
        setCustomError('');
      } catch (err) {
        setCustomError(err?.message || 'Pratinjau gagal dibuat.');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [customBytes, values, tanggalTampil, nomorTampil, selected?.id]);

  // Saran nama yang cocok dengan ketikan (maks. 6).
  const namaValue = values.nama || '';
  const saran = records.filter((r) => {
    const q = namaValue.trim().toLowerCase();
    if (!q) return false;
    return r.nama.toLowerCase().includes(q) && r.nama.toLowerCase() !== q;
  }).slice(0, 6);

  // Pilih saran: isi otomatis parameter yang namanya cocok (nim/prodi/jabatan).
  function pilihSaran(r) {
    setValues((prev) => {
      const next = { ...prev, nama: r.nama };
      if (r.nim !== undefined && 'nim' in next) next.nim = r.nim || '';
      if (r.prodi !== undefined && 'prodi' in next) next.prodi = r.prodi || next.prodi;
      if (r.jabatan !== undefined && 'jabatan' in next && JABATAN_OPTIONS.includes(r.jabatan)) next.jabatan = r.jabatan;
      return next;
    });
    setShowSaran(false);
  }

  const bisaSubmit = selected
    && (selected.params || []).filter((p) => p.type === 'string').every((p) => (values[p.name] || '').trim() !== '');

  // WhatsApp Ketua (untuk minta tanda tangan basah). Pesan dibuat dari nama
  // dan template, tapi TIDAK ditampilkan di halaman — hanya di link.
  const WA_KETUA = '62881026893759';
  const waPesan = isCustom
    ? `halo mas hendryk, saya ${namaValue.trim()} ijin minta tanda tangan ${selected?.name || 'surat'}`
    : `halo mas hendryk, saya ${namaValue.trim()} dari prodi ${(values.prodi || '').trim()}, ijin minta tanda tangan surat aktif anggota ormawa hima ilmu komputer`;
  const waHref = `https://wa.me/${WA_KETUA}?text=${encodeURIComponent(waPesan)}`;

  function selectTemplate(t) {
    setSelectedId(t.id);
    setValues(defaultValuesFor(t));
    setSubmitted(null);
    setSigMode('inline');
    setSigPos(t.kind === 'custom' ? { ...DEFAULT_SIG_POS } : null);
    setSigDragged(false);
    setErrorMsg('');
    setCustomError('');
    setTimeout(() => document.getElementById('form-surat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!bisaSubmit || !selected) return;
    const d = new Date();
    setSubmitted({ tanggal: formatTanggal(d), nomor: formatNomor(d) });
    // Simpan nama ke database supaya muncul sebagai saran berikutnya.
    if (namaValue.trim()) {
      fetch(apiPath('/api/names'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: namaValue.trim(), nim: (values.nim || '').trim(), prodi: (values.prodi || '').trim(), jabatan: values.jabatan || '' }),
      })
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data.records)) setRecords(data.records); })
        .catch(() => {});
    }
    setTimeout(() => letterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function handleReset() {
    if (!selected) return;
    setValues(defaultValuesFor(selected));
    setSubmitted(null);
    setSigMode('inline');
    setSigPos(selected.kind === 'custom' ? { ...DEFAULT_SIG_POS } : null);
    setSigDragged(false);
  }

  function handlePrint() {
    window.print();
  }

  async function fetchSignatureBytes() {
    try {
      const sigRes = await fetch(apiPath('/api/signature'), { cache: 'no-store' });
      if (sigRes.ok) return await sigRes.arrayBuffer();
    } catch { /* tanpa tanda tangan bila PNG gagal dimuat */ }
    return null;
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

  async function handlePdf() {
    if (!submitted || !selected) return;
    setBusy('pdf');
    setErrorMsg('');
    try {
      if (!isCustom) {
        // Isi template PDF asli (dengan kop + logo) lewat pdf-lib — hasilnya A4.
        const { fillSuratPdf } = await import('./lib/fillPdf.js');
        const res = await fetch(assetPath('/surat-template.pdf'));
        if (!res.ok) throw new Error('template tidak ditemukan');
        const templateBytes = await res.arrayBuffer();
        const signatureBytes = tandaTangan === 'digital' ? await fetchSignatureBytes() : null;
        const bytes = await fillSuratPdf({
          templateBytes,
          nama: (values.nama || '').trim(),
          nim: (values.nim || '').trim(),
          prodi: (values.prodi || '').trim(),
          jabatan: values.jabatan || 'Sekretaris',
          tanggalTampil,
          nomorTampil,
          tandaTangan,
          signatureBytes,
          sigPos: sigMode === 'overlay' ? sigPos : null,
        });
        const blob = new Blob([bytes], { type: 'application/pdf' });
        downloadBlob(blob, `Surat-Aktif-Ormawa-${slug(namaValue)}.pdf`);
        return;
      }
      // Template kustom: render pratinjau HTML apa adanya.
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [10, 12, 10, 12],
        filename: `${slug(selected.name)}-${slug(namaValue)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(letterRef.current).save();
    } catch {
      // Fallback bila template tidak bisa dimuat: render pratinjau HTML.
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        await html2pdf().set({
          margin: [10, 12, 10, 12],
          filename: `${slug(selected.name)}-${slug(namaValue)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        }).from(letterRef.current).save();
      } catch { setErrorMsg('PDF gagal dibuat. Coba lagi.'); }
    } finally {
      setBusy('');
    }
  }

  async function handleDocx() {
    if (!submitted || !selected) return;
    setBusy('docx');
    setErrorMsg('');
    try {
      const signatureBytes = tandaTangan === 'digital' ? await fetchSignatureBytes() : null;
      if (!isCustom) {
        // Isi template docx asli (kop + 2 logo + layout asli, ukuran A4):
        // hanya placeholder {{...}} yang diganti, sisanya tidak berubah.
        const { fillSuratDocx } = await import('./lib/fillDocx.js');
        const res = await fetch(assetPath('/surat-template.docx'));
        if (!res.ok) throw new Error('template tidak ditemukan');
        const blob = await fillSuratDocx({
          templateBytes: await res.arrayBuffer(),
          nama: (values.nama || '').trim(),
          nim: (values.nim || '').trim(),
          prodi: (values.prodi || '').trim(),
          jabatan: values.jabatan || 'Sekretaris',
          tanggalTampil,
          nomorTampil,
          tandaTangan,
          signatureBytes,
          sigPos: sigMode === 'overlay' ? sigPos : null,
        });
        downloadBlob(blob, `Surat-Aktif-Ormawa-${slug(namaValue)}.docx`);
        return;
      }
      // Template kustom: isi token {parameter | tipe | opsi} di DOCX yang diunggah.
      if (!customBytes) throw new Error('File template belum termuat.');
      const { fillGenericDocx } = await import('./lib/fillGenericDocx.js');
      const blob = await fillGenericDocx({
        templateBytes: customBytes,
        values: { ...values, tanggal: tanggalTampil, nomor: nomorTampil },
        tandaTangan,
        signatureBytes,
        sigPos: sigPos || { ...DEFAULT_SIG_POS },
      });
      downloadBlob(blob, `${slug(selected.name)}-${slug(namaValue || 'surat')}.docx`);
    } catch (err) {
      if (!isCustom) {
        // Fallback template bawaan bila template tidak bisa dimuat: bangun docx dari nol.
        try {
          const blob = await buildDocxFallback();
          downloadBlob(blob, `Surat-Aktif-Ormawa-${slug(namaValue)}.docx`);
        } catch { setErrorMsg('DOCX gagal dibuat. Coba lagi.'); }
      } else {
        setErrorMsg(err?.message || 'DOCX gagal dibuat. Coba lagi.');
      }
    } finally {
      setBusy('');
    }
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
              idRow('Nama', (values.nama || '').trim()),
              idRow('NIM', (values.nim || '').trim()),
              idRow('Program Studi', (values.prodi || '').trim()),
              idRow('Jabatan', values.jabatan || 'Sekretaris'),
              idRow('Organisasi', PENANDATANGAN.organisasi),
            ]),
            para(run(`Adalah benar-benar mahasiswa yang aktif sebagai ${values.jabatan || 'Sekretaris'} Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya masa jabatan 2026/2027.`), { alignment: AlignmentType.JUSTIFIED, spacing: { before: 120, after: 120 } }),
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

  // ---- Drag & drop tanda tangan di pratinjau ----
  // Template bawaan: tanda tangan awalnya di alur normal; saat mulai diseret,
  // posisinya diukur lalu pindah jadi overlay mengambang. Template kustom:
  // selalu overlay sejak awal (posisi awal kanan bawah).
  // PENTING: pindah ke overlay HANYA setelah pointer benar-benar bergerak
  // (ambang 6px). Ketukan biasa — misalnya jari menyentuh gambar saat
  // menggulir di HP — tidak boleh membalikkan tata letak: dalam mode overlay
  // nama naik ke posisi gambar dan gambar menimpa nama (terlihat "aneh").
  function startSigDrag(e) {
    if (tandaTangan !== 'digital') return;
    e.preventDefault();
    const letter = letterRef.current;
    if (!letter) return;
    const rect = letter.getBoundingClientRect();
    let start = sigPos;
    let converted = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev) => {
      const totalDx = ev.clientX - startX;
      const totalDy = ev.clientY - startY;
      if (!converted) {
        if (Math.hypot(totalDx, totalDy) < 6) return;
        if (sigMode === 'inline' && sigImgRef.current) {
          const r = sigImgRef.current.getBoundingClientRect();
          start = { x: ((r.left - rect.left) / rect.width) * 100, y: ((r.top - rect.top) / rect.height) * 100 };
          setSigPos(start);
          setSigMode('overlay');
        }
        if (!start) start = { ...DEFAULT_SIG_POS };
        converted = true;
      }
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      setSigPos({ x: clamp(start.x + dx, 2, 88), y: clamp(start.y + dy, 2, 94) });
      setSigDragged(true);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function resetSigPos() {
    setSigMode('inline');
    setSigPos(isCustom ? { ...DEFAULT_SIG_POS } : null);
    setSigDragged(false);
  }

  // ---- Owner ----
  async function handleLogin(e) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      const res = await fetch(apiPath('/api/auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Login gagal.');
      setOwner({ username: d.username });
      setMustChange(!!d.mustChangePassword);
      setShowLogin(false);
      setLoginPass('');
      refreshTemplates();
    } catch (err) {
      setLoginError(err?.message || 'Login gagal.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    try { await fetch(apiPath('/api/auth'), { method: 'DELETE' }); } catch { /* abaikan */ }
    setOwner(null);
    setMustChange(false);
  }

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!uploadName.trim() || !file) { setUploadError('Nama template dan file DOCX wajib diisi.'); return; }
    setUploadBusy(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append('name', uploadName.trim());
      form.append('description', uploadDesc.trim());
      form.append('file', file);
      const res = await fetch(apiPath('/api/templates'), { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Unggah gagal.');
      setUploadResult(d);
      setUploadName('');
      setUploadDesc('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      const list = await refreshTemplates(d.template.id);
      setSelectedId(d.template.id);
      setValues(defaultValuesFor(d.template));
      setSigPos({ ...DEFAULT_SIG_POS });
    } catch (err) {
      setUploadError(err?.message || 'Unggah gagal.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleDeleteTemplate(id) {
    if (!window.confirm('Hapus template ini? Pengguna tidak akan bisa lagi membuat surat dari template ini.')) return;
    try {
      const res = await fetch(apiPath(`/api/templates?id=${encodeURIComponent(id)}`), { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Hapus gagal.');
      const list = await refreshTemplates();
      if (selectedId === id && list.length > 0) {
        const pick = list.find((t) => t.isDefault) || list[0];
        selectTemplate(pick);
      }
    } catch (err) {
      setUploadError(err?.message || 'Hapus gagal.');
    }
  }

  async function handleSetDefault(id) {
    try {
      const res = await fetch(apiPath('/api/templates'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal.');
      refreshTemplates(id);
    } catch (err) {
      setUploadError(err?.message || 'Gagal menjadikan utama.');
    }
  }

  async function handleSigUpload(e) {
    e.preventDefault();
    setSigMsg('');
    setSigError('');
    const file = sigFileRef.current?.files?.[0];
    if (!file) { setSigError('Pilih file PNG tanda tangan dulu.'); return; }
    setSigBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(apiPath('/api/signature'), { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Unggah gagal.');
      setSigVersion((v) => v + 1);
      setSigMsg(`Tanda tangan baru berhasil diunggah (${Math.round(d.bytes / 1024)} KB) dan langsung dipakai di pratinjau, PDF, dan DOCX.`);
      if (sigFileRef.current) sigFileRef.current.value = '';
    } catch (err) {
      setSigError(err?.message || 'Unggah tanda tangan gagal.');
    } finally {
      setSigBusy(false);
    }
  }

  async function handleSigReset() {
    if (!window.confirm('Kembalikan ke tanda tangan bawaan?')) return;
    setSigMsg('');
    setSigError('');
    try {
      const res = await fetch(apiPath('/api/signature'), { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal.');
      setSigVersion((v) => v + 1);
      setSigMsg('Tanda tangan dikembalikan ke bawaan.');
    } catch (err) {
      setSigError(err?.message || 'Gagal mengembalikan tanda tangan.');
    }
  }

  async function handleNomorSave(e) {
    e.preventDefault();
    setNomorMsg('');
    setNomorError('');
    setNomorBusy(true);
    try {
      const res = await fetch(apiPath('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomorFormat: nomorInput }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan format nomor.');
      setNomorFormat(d.nomorFormat);
      setNomorInput(d.nomorFormat);
      setNomorMsg(`Format nomor disimpan. Contoh nomor hari ini: ${formatNomor(new Date(), d.nomorFormat)}`);
    } catch (err) {
      setNomorError(err?.message || 'Gagal menyimpan format nomor.');
    } finally {
      setNomorBusy(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg('');
    try {
      const res = await fetch(apiPath('/api/auth'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal.');
      setPwMsg('Password berhasil diubah.');
      setMustChange(false);
      setPwCurrent('');
      setPwNew('');
    } catch (err) {
      setPwMsg(err?.message || 'Gagal mengubah password.');
    }
  }

  const tampil = (v) => (v && v.trim() !== '' ? v : '........');
  const jabatanValue = values.jabatan || 'Sekretaris';

  return (
    <>
      <nav className="navbar">
        <img className="nav-logo" src={`${ASSET_BASE}/logo-himailkom.png`} alt="Logo HIMA ILKOM" />
        <span className="nav-title">Surat Aktif Ormawa</span>
        <span className="spacer" />
        {owner ? (
          <>
            <span className="who">Owner: <b>{owner.username}</b></span>
            <button className="nav-btn" type="button" onClick={handleLogout}>Keluar</button>
          </>
        ) : (
          <button className="nav-btn" type="button" onClick={() => setShowLogin((v) => !v)}>Masuk sebagai Owner</button>
        )}
      </nav>

      <header className="pagehead">
        <h1>Surat Keterangan <span>Aktif Organisasi</span></h1>
        <p>Himpunan Mahasiswa Ilmu Komputer (HIMA ILKOM) — Universitas Narotama Surabaya</p>
      </header>

      <main className="wrap">
        {showLogin && !owner && (
          <section className="panel login-panel">
            <h2>Masuk sebagai Owner</h2>
            <p className="hint">Login owner hanya untuk mengelola template surat (unggah, hapus, jadikan utama). Pengguna biasa tidak perlu login.</p>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label htmlFor="login-user">Username</label>
                <input id="login-user" type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} autoComplete="username" placeholder="owner" required />
              </div>
              <div className="field">
                <label htmlFor="login-pass">Password</label>
                <input id="login-pass" type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} autoComplete="current-password" placeholder="Password owner" required />
              </div>
              {loginError && <p className="msg err">{loginError}</p>}
              <button className="btn btn-primary" type="submit" disabled={loginBusy}>{loginBusy ? 'Masuk…' : 'Masuk'}</button>
            </form>
          </section>
        )}

        {owner && (
          <section className="panel owner-panel">
            <h2>Dasbor Owner</h2>
            <p className="hint">Kamu login sebagai <b>{owner.username}</b>. Di sini kamu bisa mengunggah template surat baru (file DOCX), menghapus template kustom, memilih template utama, mengganti gambar tanda tangan, serta mengatur format nomor surat.</p>
            {mustChange && <p className="msg warn">Kamu masih memakai password default. Ubah password di bawah ini.</p>}

            <h3>Template surat</h3>
            <ul className="tpl-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <div className="tpl-info">
                    <b>{t.name}</b>
                    <span>{t.kind === 'builtin' ? 'Bawaan' : 'Kustom'} • {(t.params || []).length} isian{t.kind === 'custom' && t.fileBytes ? ` • ${Math.round(t.fileBytes / 1024)} KB` : ''}</span>
                  </div>
                  <div className="tpl-actions">
                    {t.isDefault
                      ? <span className="pill ok">Utama</span>
                      : <button type="button" className="mini-btn" onClick={() => handleSetDefault(t.id)}>Jadikan utama</button>}
                    {t.kind === 'custom' && <button type="button" className="mini-btn danger" onClick={() => handleDeleteTemplate(t.id)}>Hapus</button>}
                  </div>
                </li>
              ))}
            </ul>

            <h3>Unggah template baru</h3>
            <form onSubmit={handleUpload}>
              <div className="field">
                <label htmlFor="up-name">Nama template *</label>
                <input id="up-name" type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Contoh: Surat Keterangan Aktif UKM" required />
              </div>
              <div className="field">
                <label htmlFor="up-desc">Deskripsi</label>
                <input id="up-desc" type="text" value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="Penjelasan singkat untuk pengguna" />
              </div>
              <div className="field">
                <label htmlFor="up-file">File DOCX (maks. 500 KB) *</label>
                <input id="up-file" type="file" accept=".docx" ref={fileInputRef} required />
              </div>
              <p className="help">
                Tulis placeholder di dalam dokumen dengan format <code>{'{nama | string}'}</code>, <code>{'{prodi | dropdown | Sistem Komputer, Teknik Informatika}'}</code>, atau <code>{'{jabatan | radio | Sekretaris, Bendahara}'}</code>. <code>{'{tanggal}'}</code> dan <code>{'{nomor}'}</code> diisi otomatis. Ketik placeholder dalam sekali ketik — jangan diedit di tengah kata, supaya tidak terpotong.
              </p>
              {uploadError && <p className="msg err">{uploadError}</p>}
              <button className="btn btn-primary" type="submit" disabled={uploadBusy}>{uploadBusy ? 'Mengunggah…' : 'Unggah Template'}</button>
            </form>
            {uploadResult && (
              <div className="meta">
                Template <b>{uploadResult.template.name}</b> berhasil diunggah.
                {(uploadResult.template.params || []).length > 0
                  ? <> Isian yang terbaca: {(uploadResult.template.params || []).map((p) => `${p.label} (${p.type})`).join(', ')}.</>
                  : ' Tidak ada placeholder yang terbaca — surat akan memakai tanggal dan nomor otomatis saja.'}
                {(uploadResult.warnings || []).map((w) => (<div key={w}>⚠ {w}</div>))}
                {(uploadResult.splitTokens || []).length > 0 && (
                  <div>⚠ Placeholder terpotong di dokumen ({uploadResult.splitTokens.join(', ')}) — unduhan DOCX bisa gagal. Ketik ulang placeholder dalam sekali ketik lalu unggah ulang.</div>
                )}
              </div>
            )}

            <h3>Tanda tangan</h3>
            <p className="hint">Tanda tangan di bawah ini yang ditempel di pratinjau, PDF, dan DOCX saat memilih tanda tangan digital.</p>
            <div className="sig-preview">
              <img src={sigUrl} alt="Tanda tangan saat ini" />
            </div>
            <form onSubmit={handleSigUpload}>
              <div className="field">
                <label htmlFor="sig-file">Unggah tanda tangan baru (PNG, maks. 500 KB) *</label>
                <input id="sig-file" type="file" accept="image/png,.png" ref={sigFileRef} required />
              </div>
              <p className="help">
                Gunakan PNG transparan agar tidak ada kotak putih di surat. Tanda tangan baru langsung dipakai di semua surat setelah diunggah.
              </p>
              {sigError && <p className="msg err">{sigError}</p>}
              {sigMsg && <p className="msg">{sigMsg}</p>}
              <button className="btn btn-primary" type="submit" disabled={sigBusy}>{sigBusy ? 'Mengunggah…' : 'Unggah Tanda Tangan'}</button>
              {' '}
              <button className="btn btn-outline" type="button" onClick={handleSigReset}>Kembalikan ke bawaan</button>
            </form>

            <h3>Format nomor surat</h3>
            <p className="hint">Nomor surat diisi otomatis dari tanggal surat dibuat. Tulis formatnya di bawah ini — bagian lain di luar placeholder dibiarkan apa adanya.</p>
            <form onSubmit={handleNomorSave}>
              <div className="field">
                <label htmlFor="nomor-format">Format nomor *</label>
                <input id="nomor-format" type="text" value={nomorInput} onChange={(e) => setNomorInput(e.target.value)} placeholder="01/HIMAILKOM/{waktu.tanggal}/{waktu.bulan.romawi}/{waktu.tahun}" required />
              </div>
              <p className="help">
                Placeholder yang bisa dipakai: <code>{NOMOR_PLACEHOLDERS.join(', ')}</code>.
                Contoh nomor hari ini: <b>{formatNomor(new Date(), nomorInput)}</b>
              </p>
              {nomorError && <p className="msg err">{nomorError}</p>}
              {nomorMsg && <p className="msg">{nomorMsg}</p>}
              <button className="btn btn-primary" type="submit" disabled={nomorBusy}>{nomorBusy ? 'Menyimpan…' : 'Simpan Format Nomor'}</button>
            </form>

            <h3>Ubah password owner</h3>
            <form onSubmit={handleChangePassword}>
              <div className="field">
                <label htmlFor="pw-current">Password lama</label>
                <input id="pw-current" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="field">
                <label htmlFor="pw-new">Password baru (min. 6 karakter)</label>
                <input id="pw-new" type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" required />
              </div>
              {pwMsg && <p className="msg">{pwMsg}</p>}
              <button className="btn btn-outline" type="submit">Ubah Password</button>
            </form>
          </section>
        )}

        <section className="templates">
          <h2>Pilih Template Surat</h2>
          <p className="hint">Pilih salah satu template di bawah ini, isi datanya, lalu cetak atau unduh. Tidak perlu login.</p>
          <div className="cards">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tpl-card${selectedId === t.id ? ' active' : ''}`}
                onClick={() => selectTemplate(t)}
              >
                <span className="card-tags">
                  <span className="card-kind">{t.kind === 'builtin' ? 'Bawaan' : 'Kustom'}</span>
                  {t.isDefault && <span className="card-default">Utama</span>}
                </span>
                <b className="card-name">{t.name}</b>
                <span className="card-desc">{t.description}</span>
                <span className="card-meta">{(t.params || []).length} isian • {t.kind === 'custom' ? 'DOCX' : 'PDF + DOCX'}</span>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <div className="layout" id="form-surat">
            <section className="panel">
              <h2>Isi Data — {selected.name}</h2>
              <p className="hint">Isi data di bawah ini, lalu tekan Buat Surat. Tanggal dan nomor surat dibuat otomatis mengikuti waktu kamu menekan tombol tersebut.</p>
              <form onSubmit={handleSubmit}>
                {(selected.params || []).map((p) => (
                  <div className="field" key={p.name}>
                    <label htmlFor={`f-${p.name}`}>{p.label} {p.type === 'string' && <span>*</span>}</label>
                    {p.type === 'string' && p.name.toLowerCase() === 'nama' ? (
                      <div className="saran-wrap">
                        <input id={`f-${p.name}`} type="text" value={values[p.name] || ''} autoComplete="off"
                          onChange={(e) => { setValues((prev) => ({ ...prev, [p.name]: e.target.value })); setShowSaran(true); }}
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
                    ) : p.type === 'string' ? (
                      <input id={`f-${p.name}`} type="text" value={values[p.name] || ''} onChange={(e) => setValues((prev) => ({ ...prev, [p.name]: e.target.value }))} placeholder={p.label} required />
                    ) : p.type === 'dropdown' ? (
                      <select id={`f-${p.name}`} value={values[p.name] || ''} onChange={(e) => setValues((prev) => ({ ...prev, [p.name]: e.target.value }))}>
                        {p.options.map((o) => (<option key={o} value={o}>{o}</option>))}
                        {!p.options.includes(values[p.name]) && (values[p.name] || '').trim() !== '' && (<option value={values[p.name]}>{values[p.name]}</option>)}
                      </select>
                    ) : (
                      <div className="radio-group" role="radiogroup" aria-label={p.label}>
                        {p.options.map((o) => (
                          <label key={o} className="radio">
                            <input type="radio" name={`f-${p.name}`} value={o} checked={values[p.name] === o} onChange={() => setValues((prev) => ({ ...prev, [p.name]: o }))} />
                            <span><b>{o}</b></span>
                          </label>
                        ))}
                      </div>
                    )}
                    {p.name.toLowerCase() === 'jabatan' && !isCustom && (
                      <div className="help">Jabatan ini muncul di bagian &ldquo;Menyatakan dengan sesungguhnya bahwa&rdquo; dan di kalimat pernyataan surat.</div>
                    )}
                  </div>
                ))}
                <div className="field">
                  <label>Tanda tangan</label>
                  <div className="radio-group" role="radiogroup" aria-label="Tanda tangan">
                    <label className="radio">
                      <input type="radio" name="tandaTangan" value="digital" checked={tandaTangan === 'digital'} onChange={() => setTandaTangan('digital')} />
                      <span><b>Tanda tangan digital</b><br />Tanda tangan yang bersangkutan (Ketua HIMA ILKOM) ditempel di surat. Seret gambarnya di pratinjau untuk memindahkan posisinya.</span>
                    </label>
                    <label className="radio">
                      <input type="radio" name="tandaTangan" value="basah" checked={tandaTangan === 'basah'} onChange={() => setTandaTangan('basah')} />
                      <span><b>Tanda tangan basah</b><br />Dikosongkan — ditandatangani langsung bertemu yang bersangkutan.</span>
                    </label>
                  </div>
                  {tandaTangan === 'basah' && (
                    <div className="wa-row">
                      <a className="btn btn-outline wa-btn" href={namaValue.trim() ? waHref : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={namaValue.trim() === ''} onClick={(e) => { if (!namaValue.trim()) e.preventDefault(); }}>
                        Minta tanda tangan via WhatsApp
                      </a>
                      {namaValue.trim() === '' && (<div className="help">Isi nama di atas dulu untuk mengirim.</div>)}
                    </div>
                  )}
                  {tandaTangan === 'digital' && (sigDragged || sigMode === 'overlay') && (
                    <div className="wa-row">
                      <button type="button" className="btn-ghost" onClick={resetSigPos}>Kembalikan posisi tanda tangan</button>
                    </div>
                  )}
                </div>
                <button className="btn btn-primary" type="submit" disabled={!bisaSubmit}>Buat Surat</button>
                {submitted && (<button className="btn-ghost" type="button" onClick={handleReset}>Buat surat baru (reset)</button>)}
              </form>

              {!isCustom && (
                <div className="meta">
                  <b>Penandatangan (tetap):</b><br />
                  Hendryk Damastra — NIM 04123008<br />
                  Ketua Himpunan Mahasiswa Ilmu Komputer
                </div>
              )}

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
              {!isCustom ? (
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
                    <tr><td className="lbl">Nama</td><td className="sep">:</td><td className={namaValue.trim() ? '' : 'placeholder'}>{tampil(namaValue)}</td></tr>
                    <tr><td className="lbl">NIM</td><td className="sep">:</td><td className={(values.nim || '').trim() ? '' : 'placeholder'}>{tampil(values.nim)}</td></tr>
                    <tr><td className="lbl">Program Studi</td><td className="sep">:</td><td className={(values.prodi || '').trim() ? '' : 'placeholder'}>{tampil(values.prodi)}</td></tr>
                    <tr><td className="lbl">Jabatan</td><td className="sep">:</td><td>{jabatanValue}</td></tr>
                    <tr><td className="lbl">Organisasi</td><td className="sep">:</td><td>{PENANDATANGAN.organisasi}</td></tr>
                  </tbody></table>

                  <p>Adalah benar-benar mahasiswa yang aktif sebagai {jabatanValue} Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya masa jabatan 2026/2027.</p>
                  <p>Dengan demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya,</p>

                  <div className={`sign${sigMode === 'overlay' ? ' sign-overlay' : ''}`}>
                    <div>Ketua HIMA ILKOM</div>
                    <div>Universitas Narotama Surabaya</div>
                    {tandaTangan === 'digital' && sigMode === 'inline' && (
                      <img ref={sigImgRef} className="sign-img sign-draggable" src={sigUrl} alt="Tanda tangan Hendryk Damastra — seret untuk memindahkan" onPointerDown={startSigDrag} draggable={false} />
                    )}
                    <div className="name">Hendryk Damastra</div>
                    <div>NIM : 04123008</div>
                  </div>

                  {tandaTangan === 'digital' && sigMode === 'overlay' && sigPos && (
                    <img className="sign-drag" style={{ left: `${sigPos.x}%`, top: `${sigPos.y}%` }} src={sigUrl} alt="Tanda tangan Hendryk Damastra — seret untuk memindahkan" onPointerDown={startSigDrag} draggable={false} />
                  )}
                </div>
              ) : (
                <div className="letter letter-custom" ref={letterRef}>
                  {customLoading && <p className="hint">Memuat pratinjau template…</p>}
                  {!customLoading && customError && <p className="msg err">{customError}</p>}
                  {!customLoading && !customError && customHtml && (
                    <div className="custom-doc" dangerouslySetInnerHTML={{ __html: customHtml }} />
                  )}
                  {!customLoading && !customError && !customHtml && (
                    <p className="hint">Pratinjau template akan muncul di sini.</p>
                  )}
                  {tandaTangan === 'digital' && sigPos && (
                    <img className="sign-drag" style={{ left: `${sigPos.x}%`, top: `${sigPos.y}%` }} src={sigUrl} alt="Tanda tangan Hendryk Damastra — seret untuk memindahkan" onPointerDown={startSigDrag} draggable={false} />
                  )}
                </div>
              )}

              <div className="actions no-print">
                <button className="btn btn-outline" type="button" onClick={handlePrint} disabled={!submitted}>Cetak</button>
                <button className="btn btn-outline" type="button" onClick={handlePdf} disabled={!submitted || busy !== ''}>{busy === 'pdf' ? 'Membuat PDF…' : 'Unduh PDF'}</button>
                <button className="btn btn-outline" type="button" onClick={handleDocx} disabled={!submitted || busy !== ''}>{busy === 'docx' ? 'Membuat DOCX…' : 'Unduh DOCX'}</button>
              </div>
              {tandaTangan === 'digital' && (
                <p className="hint no-print" style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Seret gambar tanda tangan di pratinjau untuk memindahkan posisinya — posisi yang sama dipakai di PDF, DOCX, dan cetakan.</p>
              )}
              {errorMsg && <p className="msg err no-print">{errorMsg}</p>}
              {!submitted && (<p className="hint no-print" style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Tombol Cetak / PDF / DOCX aktif setelah kamu menekan Buat Surat.</p>)}
              {submitted && (
                <div className="meta no-print">
                  Surat dibuat dengan nomor <b>{submitted.nomor}</b> pada <b>{submitted.tanggal}</b>. Mengubah isian di kiri akan memperbarui isi surat, tetapi nomor dan tanggal tetap seperti saat pertama dibuat.
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="footer">
        HIMA ILKOM Universitas Narotama Surabaya — Jl. Arief Rahman Hakim No. 51 Surabaya
      </footer>
    </>
  );
}
