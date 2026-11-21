import type { NextConfig } from "next";

// We keep the classic (dynamic-by-default) rendering model here.
// Every dashboard page depends on the logged-in user, so there is
// nothing useful to pre-render, and this keeps the code simpler.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
