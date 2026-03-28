/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow server-side fetch to external domains for website scraping
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
