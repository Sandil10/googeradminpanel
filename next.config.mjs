/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'ui-avatars.com',
                pathname: '/api/**',
            },
            {
                protocol: 'https',
                hostname: 'picsum.photos',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'fastly.picsum.photos',
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
