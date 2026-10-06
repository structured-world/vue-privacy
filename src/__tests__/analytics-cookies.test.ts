// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.example.com/page"}
import { describe, it, expect, beforeEach } from "vitest";
import { clearAnalyticsCookies } from "../core/gtag";

// gtag.js stores `_ga` and `_ga_<ID>` on the highest domain the browser accepts, so deleting
// them has to cover the host and each of its parent domains, never a bare top-level domain.

let writes: string[] = [];

beforeEach(() => {
  writes = [];
  Object.defineProperty(document, "cookie", {
    get: () => "",
    set: (value: string) => {
      writes.push(value);
    },
    configurable: true,
  });
});

/** The expiry-in-the-past writes issued for one cookie, as `name|domain` pairs. */
function deletions(name: string): string[] {
  return writes
    .filter((w) => w.startsWith(`${name}=;`) && w.includes("1970"))
    .map((w) => `${name}|${/domain=([^;]+)/.exec(w)?.[1] ?? ""}`);
}

describe("clearAnalyticsCookies", () => {
  it("deletes _ga and _ga_<ID> on the host and every parent domain", () => {
    clearAnalyticsCookies("G-TEST123");

    expect(deletions("_ga")).toEqual(["_ga|", "_ga|www.example.com", "_ga|example.com"]);
    expect(deletions("_ga_TEST123")).toEqual([
      "_ga_TEST123|",
      "_ga_TEST123|www.example.com",
      "_ga_TEST123|example.com",
    ]);
  });

  it("never targets a bare top-level domain", () => {
    clearAnalyticsCookies("G-TEST123");

    expect(writes.some((w) => /domain=com(;|$)/.test(w))).toBe(false);
  });
});
