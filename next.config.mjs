/** @type {import('next').NextConfig} */
const ADMIN_BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const MAIN_BACKEND_URL = (
    process.env.GOOGER_MAIN_API_URL
    || process.env.MAIN_BACKEND_URL
    || 'http://127.0.0.1:5000'
).replace(/\/+$/, '');

const nextConfig = {
    // Keep production browser bundles minified without exposing source maps.
    // This does not affect local development or application logic.
    productionBrowserSourceMaps: false,
    allowedDevOrigins: ['googer.site', 'admin.googer.site', '*.googer.site', 'app.infranex.it.com', 'appadmin.infranex.it.com', '*.infranex.it.com', '*.trycloudflare.com', '*.ngrok-free.app'],
    images: {
        qualities: [55, 58, 75],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                pathname: '/**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${ADMIN_BACKEND_URL}/api/:path*`,
            },
            {
                source: '/uploads/:path*',
                destination: `${ADMIN_BACKEND_URL}/uploads/:path*`,
            },
            {
                source: '/googer-api/:path*',
                destination: `${MAIN_BACKEND_URL}/api/:path*`,
            },
        ];
    },
    webpack(config, { dev }) {
        // The admin build can run on storage-constrained recovery machines where
        // webpack's filesystem cache fails with ENOSPC. Keep the cache for local
        // dev, but disable it for production builds to reduce temporary disk use.
        if (!dev) {
            config.cache = false;
        }
        return config;
    },
    turbopack: {},
};

export default nextConfig;
