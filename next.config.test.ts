import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config.ts security headers", () => {
  it("disables X-Powered-By header via poweredByHeader: false", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("exports headers() method returning security headers for source '/:path*'", async () => {
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
});
