/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/recall',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: '/recall',
  },
};

export default nextConfig;
