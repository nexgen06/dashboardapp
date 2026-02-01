/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker deployment için standalone output
  output: 'standalone',

  // Production optimizasyonları
  poweredByHeader: false,

  // Vercel build: ESLint uyarıları (react-hooks/exhaustive-deps) build'i düşürmesin
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Görsel optimizasyonları
  images: {
    domains: [],
    unoptimized: false,
  },

  // Deneysel özellikler
  experimental: {
    // Server Actions optimizasyonu
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
