/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  transpilePackages: ['three', 'postprocessing'],
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'zoomguru',
  project: 'zoomguru-landing',
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
});
