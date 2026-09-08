import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@aral/core", "@aral/content", "@aral/ui", "@aral/api", "@aral/db"],
  serverExternalPackages: ["fastify", "@fastify/cors", "@fastify/rate-limit", "@node-rs/argon2", "postgres"],
  outputFileTracingRoot: resolve(projectDir, "../.."),
  outputFileTracingIncludes: { "/api/**": ["./public/_course/manifest.json", "./public/_course/sync_catalog.json"] },
  // Includes are additive: keep browser/native payloads out of the API function.
  outputFileTracingExcludes: {
    "/api/**": [
      "./public/_course/web/**",
      "./public/_course/audio/**",
      "./public/_course/course_*.json",
      "../../packages/content/dist/course_*.json",
    ],
  },
  // Use two build workers to bound memory on smaller hosts.
  experimental: { cpus: 2 },
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }, {
      source: "/_course/:file(course_en_tl_v\\d+\\.json)",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }, {
      source: "/_course/web/:file",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }, {
      source: "/_course/manifest.json",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
    }];
  },
};

export default nextConfig;
