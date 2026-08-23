import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./security";

describe("isAllowedOrigin", () => {
  it("allows a request with no Origin header (curl, Postman, dev)", () => {
    expect(isAllowedOrigin(null, "https://example.com/api/chat")).toBe(true);
  });

  it("allows a request whose Origin matches the request's own origin", () => {
    expect(isAllowedOrigin("https://example.com", "https://example.com/api/chat")).toBe(true);
  });

  it("rejects a request whose Origin differs from the request's own origin", () => {
    expect(isAllowedOrigin("https://evil.example", "https://example.com/api/chat")).toBe(false);
  });

  it('rejects the literal string "null" (browsers send this for redirects, sandboxed iframes without allow-same-origin, some privacy extensions) — distinct from the header being absent', () => {
    expect(isAllowedOrigin("null", "https://example.com/api/chat")).toBe(false);
  });

  it("rejects a malformed Origin value that is not a valid URL", () => {
    expect(isAllowedOrigin("non-un-url", "https://example.com/api/chat")).toBe(false);
  });
});
