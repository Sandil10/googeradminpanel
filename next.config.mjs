/** @type {import('next').NextConfig} */
const nextConfig = {
    allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app'],
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
                destination: 'http://localhost:5000/api/:path*',
            },
            {
                source: '/uploads/:path*',
                destination: 'http://localhost:5000/uploads/:path*',
            },
        ];
    },
};

export default nextConfig;
