import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: any = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
