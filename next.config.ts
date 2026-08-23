import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Nessun path esplicito: risolve al default `./i18n/request.ts` (progetto senza `src/`,
// verificato in node_modules/next-intl/dist/esm/*/plugin/getNextConfig.js).
const withNextIntl = createNextIntlPlugin();

// 'unsafe-eval' serve solo in sviluppo (React usa eval per ricostruire gli stack trace
// server-side nel browser) — né React né Next.js lo usano in produzione di default.
// Verificato in node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "connect-src 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "0",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
