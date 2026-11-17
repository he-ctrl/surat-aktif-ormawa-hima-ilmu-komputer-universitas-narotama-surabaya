import './globals.css';

export const metadata = {
  title: 'Surat Keterangan Aktif Organisasi — HIMA ILKOM Universitas Narotama',
  description: 'Buat Surat Keterangan Aktif Organisasi Himpunan Mahasiswa Ilmu Komputer Universitas Narotama Surabaya. Isi nama, NIM, program studi, dan jabatan, lalu cetak atau unduh sebagai PDF dan DOCX.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
