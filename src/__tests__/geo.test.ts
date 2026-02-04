// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkerGeoDetector, AutoGeoDetector, createGeoDetector } from "../geo/index";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
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
      isEU: true,
      countryCode: "DE",
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
      isEU: false,
      countryCode: "US",
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

  it("treats missing or non-boolean isEU as false", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: "XX" }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result.isEU).toBe(false);
  });

  it("handles missing countryCode gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ isEU: true }),
    });

    const detector = new WorkerGeoDetector("/api/geo");
    const result = await detector.detect();

    expect(result).toEqual({
      isEU: true,
      countryCode: undefined,
      method: "worker",
    });
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
    expect(result.isEU).toBe(true);
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
    expect(result.isEU).toBe(false);
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
    expect(result.isEU).toBe(true);
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
    expect(result.log![0].result).toEqual({ isEU: true, countryCode: "DE" });
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
    expect(result.log![1].result).toEqual({ isEU: true, countryCode: "FR" });
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
    expect(result.log![1].error).toBe("No geoUrl configured");

    expect(result.log![2].method).toBe("api");
    expect(result.log![2].status).toBe("success");
  });

  it("includes all attempts when falling through to timezone", async () => {
    // All methods fail except timezone
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
    expect((await always.detect()).isEU).toBe(true);

    const never = createGeoDetector("never");
    expect((await never.detect()).isEU).toBe(false);
  });
});
