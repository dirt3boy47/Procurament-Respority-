import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the signed-in user's session, so pages render per request
  // (the classic dynamic model) rather than using Cache Components.
  serverExternalPackages: ["@react-pdf/renderer"],
  // This app lives in a sub-folder of the repository; trace files from here.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
