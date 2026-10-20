/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@procurex/domain", "@procurex/db", "@procurex/ui"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
