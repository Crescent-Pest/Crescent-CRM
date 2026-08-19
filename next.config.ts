import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // stray lockfile in C:\Users\logan confuses workspace-root inference
  turbopack: {
    root: __dirname,
  },
  // /api/plan reads docs/pests/*.md with fs at runtime; make sure the files
  // are traced into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/plan": ["./docs/pests/*.md"],
  },
};

export default nextConfig;
