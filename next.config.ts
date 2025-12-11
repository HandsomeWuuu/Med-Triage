import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 配置开发服务器跨域访问
  allowedDevOrigins: ['http://192.168.3.10:3000'],
};

export default nextConfig;
