import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "../core/types";

describe("DEFAULT_CONFIG", () => {
  it("should have required cookie settings", () => {
    expect(DEFAULT_CONFIG.cookie.name).toBe("consent_preferences");
    expect(DEFAULT_CONFIG.cookie.expiry).toBe(365);
    expect(DEFAULT_CONFIG.cookie.path).toBe("/");
  });

  it("should have required banner settings", () => {
    expect(DEFAULT_CONFIG.banner.title).toBe("Cookie Consent");
    expect(DEFAULT_CONFIG.banner.acceptAll).toBe("Accept All");
    expect(DEFAULT_CONFIG.banner.rejectAll).toBe("Reject All");
  });

  it("should have default category settings", () => {
    expect(DEFAULT_CONFIG.categories.analytics).toBe(false);
    expect(DEFAULT_CONFIG.categories.marketing).toBe(false);
    expect(DEFAULT_CONFIG.categories.functional).toBe(true);
  });

  it("should have auto EU detection by default", () => {
    expect(DEFAULT_CONFIG.euDetection).toBe("auto");
  });
});
