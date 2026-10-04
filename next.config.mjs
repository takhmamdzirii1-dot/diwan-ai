import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Edge rewrites only: no analytics function, queue or extra vendor.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)) return [];
    const assets = host.replace('.i.posthog.com', '-assets.i.posthog.com');
    return [
      { source: '/v-events/static/:path*', destination: `${assets}/static/:path*` },
      { source: '/v-events/array/:path*', destination: `${assets}/array/:path*` },
      { source: '/v-events/:path*', destination: `${host}/:path*` },
    ];
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // PptxGenJS declares fs/https as browser:false; normalize its node: imports
      // so Webpack can honor those existing browser exclusions.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:(fs|https)$/, resource => {
        resource.request = resource.request.slice(5);
      }));
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
