/** @type {import('next').NextConfig} */
const nextConfig = {
  // Spec v0.9 mục 3a — Nguyên tắc Portability.
  // 'standalone' cho phép build thành container bất cứ lúc nào: rời Vercel
  // = viết một Dockerfile + đổi env, không phải viết lại kiến trúc.
  output: 'standalone',
  reactStrictMode: true,
  eslint: { dirs: ['app', 'lib', 'components', 'scripts'] },
};
export default nextConfig;
