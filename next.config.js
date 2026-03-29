// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Cloudflare Pages (next-on-pages)
  // output: 'export' is NOT needed — next-on-pages handles this
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

module.exports = nextConfig;
