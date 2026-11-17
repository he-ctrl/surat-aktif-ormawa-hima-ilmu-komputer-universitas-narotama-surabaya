/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aset dimuat dari domain produksi Vercel proyek ini (Vercel memotong nama
  // domain karena nama proyek terlalu panjang), supaya halaman tetap jalan
  // saat diproxy lewat hendrykdamastra.my.id/surat-aktif-ormawa-hima-ilmu-komputer-universitas-narotama-surabaya
  assetPrefix: 'https://surat-aktif-ormawa-hima-ilmu-komput.vercel.app',
};
export default nextConfig;
