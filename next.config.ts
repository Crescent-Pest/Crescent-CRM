import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // stray lockfile in C:\Users\logan confuses workspace-root inference
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
