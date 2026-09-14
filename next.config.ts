import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory made Turbopack infer the wrong
  // workspace root; pin it to this project.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdf-parse reads files from disk and must stay a real Node module rather
  // than being bundled into the server output.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
