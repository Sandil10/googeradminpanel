/** @type {import('next').NextConfig} */
const ADMIN_BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3002').replace(/\/+$/, '');
const MAIN_BACKEND_URL = (
    process.env.GOOGER_MAIN_API_URL
    || process.env.MAIN_BACKEND_URL
    || 'http://localhost:5000'
).replace(/\/+$/, '');

const nextConfig = {
    // Keep production browser bundles minified without exposing source maps.
    // This does not affect local development or application logic.
    productionBrowserSourceMaps: false,
    allowedDevOrigins: ['app.infranex.it.com', 'appadmin.infranex.it.com', '*.infranex.it.com', '*.trycloudflare.com', '*.ngrok-free.app'],
    images: {
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
};

export default nextConfig;
