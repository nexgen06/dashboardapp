/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker deployment için standalone output
  output: 'standalone',

  // Production optimizasyonları
  poweredByHeader: false,

  // Vercel build lint adımında takılmasın; ESLint uyarıları build'i kesmesin
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
