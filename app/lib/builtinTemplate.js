// Template bawaan: Surat Keterangan Aktif Organisasi (HIMA ILKOM).
// Template ini TIDAK disimpan di KV — ia adalah bagian dari repo (file
// public/surat-template.pdf/.docx) dan selalu ada. Template kustom yang
// diunggah owner disimpan di KV dan digabung dengan yang ini di /api/templates.

export const PRODI_OPTIONS = ['Sistem Komputer', 'Teknik Informatika', 'Sistem Informasi'];
export const JABATAN_OPTIONS = ['Sekretaris', 'Bendahara', 'Dokumentasi', 'Humas'];

export const BUILTIN_TEMPLATE = {
  id: 'builtin-aktif-ormawa',
  name: 'Surat Keterangan Aktif Organisasi',
  description: 'Surat keterangan aktif anggota Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya.',
  kind: 'builtin',
  isDefault: true,
  fileBytes: 84613,
  createdAt: '2026-11-17',
  params: [
    { name: 'nama', label: 'Nama', type: 'string', options: [] },
    { name: 'nim', label: 'NIM', type: 'string', options: [] },
    { name: 'prodi', label: 'Program Studi', type: 'dropdown', options: PRODI_OPTIONS },
    { name: 'jabatan', label: 'Jabatan', type: 'radio', options: JABATAN_OPTIONS },
  ],
};
