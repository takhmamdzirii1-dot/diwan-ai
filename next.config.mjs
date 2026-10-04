import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
