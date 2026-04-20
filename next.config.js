/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    unoptimized: true, // évite les 400 sur _next/image avec R2 et /api/uploads (disque éphémère)
    remotePatterns: [
      // AWS S3 (bucket.s3.region.amazonaws.com)
      { protocol: 'https', hostname: '**.amazonaws.com', pathname: '/**' },
      // Render (ecommerce-marketplace-smvw.onrender.com)
      { protocol: 'https', hostname: '*.onrender.com', pathname: '/**' },
      // Cloudflare R2 (pub-xxx.r2.dev)
      { protocol: 'https', hostname: '*.r2.dev', pathname: '/**' },
      // Local dev
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
    ],
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

module.exports = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
