// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeUrl } from "../vanilla/utils";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('foo "bar"')).toBe("foo &quot;bar&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("foo 'bar'")).toBe("foo &#39;bar&#39;");
  });

  it("escapes multiple special characters", () => {
    expect(escapeHtml('<a href="test">link</a>')).toBe(
      "&lt;a href=&quot;test&quot;&gt;link&lt;/a&gt;"
    );
  });

  it("returns unchanged string without special chars", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("sanitizeUrl", () => {
  it("blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert('xss')")).toBe("#");
  });

  it("blocks javascript: protocol case-insensitive", () => {
    expect(sanitizeUrl("JAVASCRIPT:alert('xss')")).toBe("#");
    expect(sanitizeUrl("JavaScript:alert('xss')")).toBe("#");
  });

  it("blocks data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<script>alert('xss')</script>")).toBe("#");
  });

  it("blocks data: protocol case-insensitive", () => {
    expect(sanitizeUrl("DATA:text/html,<script>")).toBe("#");
  });

  it("blocks vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:msgbox('xss')")).toBe("#");
  });

  it("blocks vbscript: protocol case-insensitive", () => {
    expect(sanitizeUrl("VBSCRIPT:msgbox('xss')")).toBe("#");
  });

  it("allows http: URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows https: URLs", () => {
    expect(sanitizeUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("allows relative URLs", () => {
    expect(sanitizeUrl("/privacy")).toBe("/privacy");
    expect(sanitizeUrl("./page.html")).toBe("./page.html");
  });

  it("allows mailto: links", () => {
    expect(sanitizeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
  });

  it("allows tel: links", () => {
    expect(sanitizeUrl("tel:+1234567890")).toBe("tel:+1234567890");
  });

  it("trims whitespace from URLs", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("blocks dangerous protocol with leading whitespace", () => {
    expect(sanitizeUrl("  javascript:alert('xss')")).toBe("#");
  });

  it("preserves query parameters", () => {
    expect(sanitizeUrl("/page?foo=bar&baz=qux")).toBe("/page?foo=bar&baz=qux");
  });

  it("preserves hash fragments", () => {
    expect(sanitizeUrl("/page#section")).toBe("/page#section");
  });
});
