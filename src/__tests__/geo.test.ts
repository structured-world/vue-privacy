// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WorkerGeoDetector,
  AutoGeoDetector,
  CloudflareGeoDetector,
  IPAPIGeoDetector,
  TimezoneGeoDetector,
  createGeoDetector,
} from "../geo/index";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("WorkerGeoDetector", () => {
  it("returns EU result from worker endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ isEU: true, countryCode: "DE" }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result).toEqual({
      consentRequired: true,
      countryCode: "DE",
      region: undefined,
      method: "worker",
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/geo");
  });

  it("returns non-EU result from worker endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ isEU: false, countryCode: "US" }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result).toEqual({
      consentRequired: false,
      countryCode: "US",
      region: undefined,
      method: "worker",
    });
  });

  it("parses region field from worker response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ isEU: false, countryCode: "US", region: "California" }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result).toEqual({
      consentRequired: false,
      countryCode: "US",
      region: "California",
      method: "worker",
    });
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const detector = new WorkerGeoDetector("/api/geo");
    await expect(detector.detect()).rejects.toThrow("Worker geo-detection failed");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const detector = new WorkerGeoDetector("/api/geo");
    await expect(detector.detect()).rejects.toThrow("Worker geo-detection failed");
  });

  it("decides from the country when the endpoint gives no isEU flag", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: "XX" }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.consentRequired).toBe(false);
  });

  it("handles missing countryCode gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ isEU: true }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result).toEqual({
      consentRequired: true,
      countryCode: undefined,
      region: undefined,
      method: "worker",
    });
  });
});

/** Makes the browser report this IANA time zone. */
function useTimezone(timeZone: string): void {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...new Intl.DateTimeFormat().resolvedOptions(),
    timeZone,
  });
}

// "Needs consent" follows the consent jurisdictions (EEA and UK by default), not EU membership:
// the GDPR applies in Norway, Iceland and Liechtenstein through the EEA Agreement, and the UK
// GDPR and PECR in the United Kingdom.
describe("consent jurisdictions in the detectors", () => {
  it("IP API: decides from the country code, not from in_eu", async () => {
    for (const country of ["NO", "IS", "LI", "GB", "CY"]) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ in_eu: false, country_code: country }),
      });
      const result = await new IPAPIGeoDetector().detect();
      expect({ country, required: result.consentRequired }).toEqual({ country, required: true });
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ in_eu: false, country_code: "US" }),
    });
    expect((await new IPAPIGeoDetector().detect()).consentRequired).toBe(false);
  });

  it("IP API: a response without a country code is a failure, not a visitor outside", async () => {
    // Regression: ipapi.co answers a rate-limited request with an error body; `in_eu` missing
    // read as false and granted every category.
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: true, reason: "RateLimited" }),
    });

    await expect(new IPAPIGeoDetector().detect()).rejects.toThrow("IP API geo-detection failed");
  });

  it("Cloudflare: decides from CF-IPCountry when the EU flag says false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-Is-EU-Country": "false", "CF-IPCountry": "GB" }),
    });

    const result = await new CloudflareGeoDetector().detect();

    expect(result).toEqual({ consentRequired: true, countryCode: "GB", method: "cloudflare" });
  });

  it("Cloudflare: an EU flag of false without a country is a failure", async () => {
    // Cloudflare's flag covers EU members only: false alone says nothing about the EEA or the UK.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-Is-EU-Country": "false" }),
    });

    await expect(new CloudflareGeoDetector().detect()).rejects.toThrow(
      "Cloudflare geo-detection failed"
    );
  });

  it("Cloudflare: an EU flag of true without a country requires consent", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-Is-EU-Country": "true" }),
    });

    expect(await new CloudflareGeoDetector().detect()).toEqual({
      consentRequired: true,
      countryCode: undefined,
      method: "cloudflare",
    });
  });

  it("Worker: decides from the country code, and fails without one when its flag is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isEU: false, countryCode: "NO" }),
    });
    expect((await new WorkerGeoDetector("/api/geo").detect()).consentRequired).toBe(true);

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ isEU: false }) });
    await expect(new WorkerGeoDetector("/api/geo").detect()).rejects.toThrow(
      "Worker geo-detection failed"
    );
  });

  it("timezone: maps the zones of consent countries, outermost regions included", async () => {
    // Regression: Cyprus, the Azores, Åland, Ceuta, Büsingen, the French outermost regions,
    // Iceland and the UK were missing from the timezone table.
    const cases: Array<[string, string]> = [
      ["Asia/Nicosia", "CY"],
      ["Europe/Nicosia", "CY"],
      ["Atlantic/Azores", "PT"],
      ["Europe/Mariehamn", "AX"],
      ["Africa/Ceuta", "ES"],
      ["Europe/Busingen", "DE"],
      ["America/Guadeloupe", "GP"],
      ["Indian/Reunion", "RE"],
      ["Atlantic/Reykjavik", "IS"],
      ["Europe/London", "GB"],
    ];
    for (const [zone, country] of cases) {
      useTimezone(zone);
      const result = await new TimezoneGeoDetector().detect();
      expect({ zone, ...result }).toEqual({
        zone,
        consentRequired: true,
        countryCode: country,
        method: "fallback",
      });
    }
  });

  it("timezone: zones of countries outside the jurisdictions do not require consent", async () => {
    // Regression: Sarajevo, Skopje, Tirane, Monaco, Andorra, San Marino and the Vatican were in
    // the table with no rule behind them.
    for (const zone of ["Europe/Sarajevo", "Europe/Monaco", "Europe/Vatican", "America/New_York"]) {
      useTimezone(zone);
      expect(await new TimezoneGeoDetector().detect()).toEqual({
        consentRequired: false,
        method: "fallback",
      });
    }
    useTimezone("Europe/Zurich");
    expect(await new TimezoneGeoDetector().detect()).toEqual({
      consentRequired: false,
      countryCode: "CH",
      method: "fallback",
    });
  });

  it("timezone: UTC says nothing about the location and is a failure", async () => {
    // Privacy-hardened browsers report UTC everywhere, the EU included.
    for (const zone of ["UTC", "Etc/UTC", "Etc/GMT"]) {
      useTimezone(zone);
      await expect(new TimezoneGeoDetector().detect()).rejects.toThrow(
        "Timezone geo-detection failed"
      );
    }
  });

  it("auto: fails when every method fails, the timezone included", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    mockFetch.mockRejectedValueOnce(new Error("ipapi unavailable"));
    useTimezone("Etc/UTC");

    await expect(new AutoGeoDetector().detect()).rejects.toThrow(
      "All geo-detection methods failed"
    );
  });
});

describe("AutoGeoDetector", () => {
  it("uses worker when geoUrl is provided and cloudflare fails", async () => {
    // First call: Cloudflare HEAD request — fail
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    // Second call: Worker /api/geo — succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isEU: true, countryCode: "FR" }),
    });

    const detector = new AutoGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.method).toBe("worker");
    expect(result.consentRequired).toBe(true);
  });

  it("skips worker when geoUrl is not provided", async () => {
    // First call: Cloudflare HEAD — fail
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    // Second call: ipapi.co — succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ in_eu: false, country_code: "US" }),
    });

    const detector = new AutoGeoDetector();
    const result = await detector.detect();

    expect(result.method).toBe("api");
    expect(result.consentRequired).toBe(false);
  });

  it("falls through to ipapi when worker also fails", async () => {
    // Cloudflare — fail
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    // Worker — fail
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // ipapi — succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ in_eu: true, country_code: "DE" }),
    });

    const detector = new AutoGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.method).toBe("api");
    expect(result.consentRequired).toBe(true);
  });
});

describe("AutoGeoDetector detection log", () => {
  it("returns detection log with successful cloudflare attempt", async () => {
    // Cloudflare succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        "X-Is-EU-Country": "true",
        "CF-IPCountry": "DE",
      }),
    });

    const detector = new AutoGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.log).toBeDefined();
    expect(result.log!.length).toBe(1);
    expect(result.log![0].method).toBe("cloudflare");
    expect(result.log![0].status).toBe("success");
    expect(result.log![0].result).toEqual({ consentRequired: true, countryCode: "DE" });
    expect(result.log![0].duration).toBeGreaterThanOrEqual(0);
  });

  it("returns detection log with failed cloudflare and successful worker", async () => {
    // Cloudflare fails
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    // Worker succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isEU: true, countryCode: "FR" }),
    });

    const detector = new AutoGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.log).toBeDefined();
    expect(result.log!.length).toBe(2);

    // First entry: cloudflare failed
    expect(result.log![0].method).toBe("cloudflare");
    expect(result.log![0].status).toBe("failed");
    expect(result.log![0].error).toContain("Cloudflare");

    // Second entry: worker succeeded
    expect(result.log![1].method).toBe("worker");
    expect(result.log![1].status).toBe("success");
    expect(result.log![1].result).toEqual({ consentRequired: true, countryCode: "FR" });
  });

  it("includes skipped entry when geoUrl not provided", async () => {
    // Cloudflare fails
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    // ipapi succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ in_eu: false, country_code: "US" }),
    });

    // No geoUrl = worker skipped
    const detector = new AutoGeoDetector();
    const result = await detector.detect();

    expect(result.log).toBeDefined();
    expect(result.log!.length).toBe(3);

    expect(result.log![0].method).toBe("cloudflare");
    expect(result.log![0].status).toBe("failed");

    expect(result.log![1].method).toBe("worker");
    expect(result.log![1].status).toBe("skipped");
    expect(result.log![1].error).toBeUndefined(); // skipped != failed, no error

    expect(result.log![2].method).toBe("api");
    expect(result.log![2].status).toBe("success");
  });

  it("includes all attempts when falling through to timezone", async () => {
    // All methods fail except timezone; a set zone, since CI machines run in UTC (no answer)
    useTimezone("Europe/Berlin");
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }); // Worker fails
    mockFetch.mockRejectedValueOnce(new Error("ipapi unavailable")); // ipapi fails

    const detector = new AutoGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.method).toBe("fallback");
    expect(result.log).toBeDefined();
    expect(result.log!.length).toBe(4);

    expect(result.log![0].method).toBe("cloudflare");
    expect(result.log![0].status).toBe("failed");

    expect(result.log![1].method).toBe("worker");
    expect(result.log![1].status).toBe("failed");

    expect(result.log![2].method).toBe("api");
    expect(result.log![2].status).toBe("failed");

    expect(result.log![3].method).toBe("fallback");
    expect(result.log![3].status).toBe("success");
  });
});

describe("createGeoDetector", () => {
  it("creates WorkerGeoDetector for worker mode", () => {
    const detector = createGeoDetector("worker", "/api/geo");
    expect(detector).toBeInstanceOf(WorkerGeoDetector);
  });

  it("throws when worker mode used without geoUrl", () => {
    expect(() => createGeoDetector("worker")).toThrow(
      "geoUrl is required for worker geo-detection mode"
    );
  });

  it("passes geoUrl to AutoGeoDetector in auto mode", async () => {
    // Cloudflare — fail
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare unavailable"));
    // Worker — succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isEU: true, countryCode: "IT" }),
    });

    const detector = createGeoDetector("auto", "/api/geo");
    const result = await detector.detect();

    expect(result.method).toBe("worker");
  });

  it("returns manual detectors for always/never modes", async () => {
    const always = createGeoDetector("always");
    expect((await always.detect()).consentRequired).toBe(true);

    const never = createGeoDetector("never");
    expect((await never.detect()).consentRequired).toBe(false);
  });
});
