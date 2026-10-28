import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "@electric-sql/pglite"],
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  // Files read from disk at runtime that the bundler can't see: the demo database (snapshot, migrations and seeds,
  // plus PGlite's WebAssembly and extensions) and the images embedded in datasheet PDFs.
  outputFileTracingIncludes: {
    "/**": ["./demo-snapshot/**/*", "./supabase/migrations/**/*", "./supabase/*.sql", "./node_modules/@electric-sql/pglite/dist/**/*"],
    "/products/**": ["./public/catalog/datasheet/**/*", "./public/site/logo-hd.png"],
  },
  // Every page reads the signed-in user's data under RLS, so render dynamically per request.
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
