import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextConfig } from "next";

const originalNodeEnv = process.env.NODE_ENV;

async function loadConfig(nodeEnv: string): Promise<NextConfig> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  const mod = await import("./next.config");
  return mod.default;
}

async function getCspValue(nodeEnv: string): Promise<string | undefined> {
  const nextConfig = await loadConfig(nodeEnv);
  if (!nextConfig.headers) return undefined;
  const routesHeaders = await nextConfig.headers();
  return routesHeaders[0].headers.find((h) => h.key === "Content-Security-Policy")?.value;
}

describe("next.config.ts security headers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
    vi.resetModules();
  });

  it("disables X-Powered-By header via poweredByHeader: false", async () => {
    const nextConfig = await loadConfig("production");
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("exports headers() method returning security headers for source '/:path*'", async () => {
    const nextConfig = await loadConfig("production");
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) return;

    const routesHeaders = await nextConfig.headers();
    expect(routesHeaders).toHaveLength(1);
    expect(routesHeaders[0].source).toBe("/:path*");

    const headerKeys = routesHeaders[0].headers.map((h) => h.key);
    expect(headerKeys).toContain("Content-Security-Policy");
    expect(headerKeys).toContain("X-Frame-Options");
    expect(headerKeys).toContain("X-Content-Type-Options");
    expect(headerKeys).toContain("Referrer-Policy");
    expect(headerKeys).toContain("Permissions-Policy");
    expect(headerKeys).toContain("Strict-Transport-Security");
    expect(headerKeys).toContain("X-XSS-Protection");

    const cspHeader = routesHeaders[0].headers.find((h) => h.key === "Content-Security-Policy");
    expect(cspHeader?.value).toContain("default-src 'self'");
    expect(cspHeader?.value).toContain("object-src 'none'");
    expect(cspHeader?.value).toContain("base-uri 'self'");
    expect(cspHeader?.value).toContain("frame-ancestors 'none'");
    expect(cspHeader?.value).toContain("connect-src 'self'");

    const xFrameHeader = routesHeaders[0].headers.find((h) => h.key === "X-Frame-Options");
    expect(xFrameHeader?.value).toBe("DENY");

    const xContentTypeHeader = routesHeaders[0].headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xContentTypeHeader?.value).toBe("nosniff");

    const xssProtectionHeader = routesHeaders[0].headers.find((h) => h.key === "X-XSS-Protection");
    expect(xssProtectionHeader?.value).toBe("0");
  });

  it("omits 'unsafe-eval' from script-src in production (neither React nor Next.js need eval in production)", async () => {
    const cspValue = await getCspValue("production");
    expect(cspValue).toContain("script-src 'self' 'unsafe-inline'");
    expect(cspValue).not.toContain("unsafe-eval");
  });

  it("includes 'unsafe-eval' in script-src in development (React uses eval for server error stack reconstruction)", async () => {
    const cspValue = await getCspValue("development");
    expect(cspValue).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });
});
