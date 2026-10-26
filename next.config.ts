import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Photos are resized on the phone first (usually under 400 KB), but leave
    // room for an unresized photo from a browser that can't resize.
    serverActions: { bodySizeLimit: "6mb" },
  },
  partialPrefetching: true,
  // Safety settings sent with every page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Search engines: don't index or follow anything.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // No other site may show these pages inside its own (stops "clickjacking").
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Browsers must use the file types we say, and always use HTTPS.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Don't tell other sites which family page someone came from.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The site never needs the camera, microphone or location.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
