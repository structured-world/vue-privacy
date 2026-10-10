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

  it("should detect the visitor's country automatically by default", () => {
    expect(DEFAULT_CONFIG.geoDetection).toBe("auto");
  });
});
