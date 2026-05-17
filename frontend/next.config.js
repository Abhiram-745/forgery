/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
}

module.exports = nextConfig
