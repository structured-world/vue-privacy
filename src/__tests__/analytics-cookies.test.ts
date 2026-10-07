// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.example.com/page"}
import { describe, it, expect, beforeEach } from "vitest";
import { clearAnalyticsCookies } from "../core/gtag";

// gtag.js stores `_ga` and `_ga_<ID>` on the highest domain the browser accepts, so deleting
// them has to cover the host and each of its parent domains, never a bare top-level domain.

let writes: string[] = [];
/** What document.cookie reads back: the cookies currently on the page. */
let jar = "";

beforeEach(() => {
  writes = [];
  jar = "";
  Object.defineProperty(document, "cookie", {
    get: () => jar,
    set: (value: string) => {
      writes.push(value);
    },
    configurable: true,
  });
});

/** The expiry-in-the-past writes issued for one cookie on path "/", as `name|domain` pairs. */
function deletions(name: string): string[] {
  return writes
    .filter((w) => w.startsWith(`${name}=;`) && w.includes("1970") && /path=\/(;|$)/.test(w))
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

  it("deletes cookies renamed by cookie_prefix on every path of the page", () => {
    // Regression: only the default names on "/" were deleted, so a site using cookie_prefix or
    // cookie_path kept the client and session identifiers after a withdrawal.
    jar = "site_ga=GA1.1.1; site_ga_TEST123=GS1.1.2; _ga=GA1.1.3; session=keep";

    clearAnalyticsCookies("G-TEST123");

    const deleted = new Set(writes.filter((w) => w.includes("1970")).map((w) => w.split("=")[0]));
    expect(deleted).toEqual(new Set(["_ga", "_ga_TEST123", "site_ga", "site_ga_TEST123"]));
    expect(writes.some((w) => w.startsWith("site_ga=;") && w.includes("path=/page"))).toBe(true);
  });

  it("deletes on the cookie_path, cookie_prefix and cookie_domain the tag was configured with", () => {
    // Regression: a cookie_path outside the current route hides the cookies from
    // document.cookie, so they survived; the tag's own configuration names them.
    window.dataLayer = [
      ["set", { cookie_prefix: "site" }],
      ["config", "G-TEST123", { cookie_path: "/analytics/", cookie_domain: "stats.example.com" }],
    ];

    clearAnalyticsCookies("G-TEST123");

    const hit = (name: string): boolean =>
      writes.some(
        (w) =>
          w.startsWith(`${name}=;`) &&
          w.includes("path=/analytics/") &&
          w.includes("domain=stats.example.com")
      );
    expect(hit("site_ga")).toBe(true);
    expect(hit("site_ga_TEST123")).toBe(true);
    window.dataLayer = [];
  });

  it("leaves cookies whose names end like GA's but whose values are not GA's", () => {
    // Regression: any name ending in _ga was deleted, including a site cookie (or a consent
    // cookie) that merely shares the suffix.
    jar = "privacy_ga=%7B%22categories%22%7D; site_ga=GA1.1.1.2; notes_ga_TEST123=hello";

    clearAnalyticsCookies("G-TEST123");

    const deleted = new Set(writes.filter((w) => w.includes("1970")).map((w) => w.split("=")[0]));
    expect(deleted.has("site_ga")).toBe(true);
    expect(deleted.has("privacy_ga")).toBe(false);
    expect(deleted.has("notes_ga_TEST123")).toBe(false);
  });

  it("never targets a bare top-level domain", () => {
    clearAnalyticsCookies("G-TEST123");

    expect(writes.some((w) => /domain=com(;|$)/.test(w))).toBe(false);
  });
});
