import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

// @vercel/functions::ipAddress legge esclusivamente l'header "x-real-ip" (verificato nel
// sorgente installato, node_modules/@vercel/functions/headers.js) — non "x-forwarded-for".
describe("getClientIp", () => {
  it("ritorna l'IP da x-real-ip quando presente", () => {
    const req = new Request("https://example.com/api/chat", {
      headers: { "x-real-ip": "203.0.113.5" },
    });

    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("ritorna 'unknown' quando l'header manca (es. dev locale)", () => {
    const req = new Request("https://example.com/api/chat");

    expect(getClientIp(req)).toBe("unknown");
  });
});
