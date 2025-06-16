/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // Don't resolve 'fs' module on the client to prevent this error
            config.resolve.fallback = {
                fs: false,
                path: false,
                os: false,
            };
        }
        return config;
    }
};

export default nextConfig;
