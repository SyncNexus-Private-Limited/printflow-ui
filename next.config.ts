import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent the page from being rendered inside an iframe (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy XSS filter — defence-in-depth for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Limit referrer information sent to external sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS for 2 years, include subdomains, allow preload list submission
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Disable browser features this app does not use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
