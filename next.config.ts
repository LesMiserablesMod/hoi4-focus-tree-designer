import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/hoi4-focus-tree-designer",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
