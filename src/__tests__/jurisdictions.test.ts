import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  JURISDICTION_COUNTRIES,
  TIMEZONE_COUNTRIES,
  consentCountries,
  requiresConsent,
} from "../geo/jurisdictions";

// The timezone fallback must know every zone of every consent country, or a visitor there is
// taken for one outside it. The table is checked against the tz database (fixtures/tzdata, a
// verbatim copy of an IANA release): updating the fixture to a newer release shows any drift.

const TZDATA = join(__dirname, "fixtures", "tzdata");

/** zone.tab: one row per (country, zone), in its deprecated single-country form. */
function zoneTab(): Map<string, string> {
  const zones = new Map<string, string>();
  for (const line of readFileSync(join(TZDATA, "zone.tab"), "utf8").split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const [country, , zone] = line.split("\t");
    zones.set(zone, country);
  }
  return zones;
}

/** backward: `Link TARGET NAME [#= TARGET1]`, as name -> the zone it stands for. */
function backwardLinks(): Map<string, string> {
  const links = new Map<string, string>();
  for (const line of readFileSync(join(TZDATA, "backward"), "utf8").split("\n")) {
    const match = /^Link\s+(\S+)\s+(\S+)(?:\s+#=\s+(\S+))?/.exec(line);
    if (match) links.set(match[2], match[3] ?? match[1]);
  }
  return links;
}

/**
 * Backward names that resolve to a consent country's zone but do not stand for that country:
 * the generic CET/MET/EET/WET zones, and Jan Mayen (Norwegian territory, ISO SJ), linked to the
 * German zone only because their clocks agree.
 */
const NOT_COUNTRY_ALIASES = new Set(["CET", "MET", "EET", "WET", "Atlantic/Jan_Mayen"]);

describe("TIMEZONE_COUNTRIES", () => {
  it("holds exactly the tz database zones of the consent countries", () => {
    const countries = consentCountries(["EEA", "UK", "CH"]);
    const zones = zoneTab();
    const expected: Record<string, string> = {};
    for (const [zone, country] of zones) {
      if (countries.has(country)) expected[zone] = country;
    }
    for (const [name, target] of backwardLinks()) {
      const country = zones.get(target);
      if (zones.has(name) || NOT_COUNTRY_ALIASES.has(name) || country === undefined) continue;
      if (countries.has(country)) expected[name] = country;
    }

    expect(TIMEZONE_COUNTRIES).toEqual(expected);
  });

  it("covers every country of every jurisdiction", () => {
    const covered = new Set(Object.values(TIMEZONE_COUNTRIES));
    for (const countries of Object.values(JURISDICTION_COUNTRIES)) {
      for (const country of countries) expect(covered).toContain(country);
    }
  });
});

describe("requiresConsent", () => {
  it("requires consent across the EEA and the UK by default", () => {
    // Regression: `in_eu` and Cloudflare's EU flag are false for Norway, Iceland, Liechtenstein
    // and the UK, whose law requires consent all the same.
    for (const country of ["DE", "CY", "NO", "IS", "LI", "GB", "GP", "AX"]) {
      expect(requiresConsent(country, false)).toBe(true);
    }
  });

  it("does not require consent outside the configured jurisdictions", () => {
    for (const country of ["US", "CH", "BA", "MC", "SJ", "JE"]) {
      expect(requiresConsent(country, true)).toBe(false);
    }
  });

  it("requires consent in Switzerland only when CH is configured", () => {
    expect(requiresConsent("CH", false, ["EEA", "UK", "CH"])).toBe(true);
    expect(requiresConsent("GB", true, ["EEA"])).toBe(false);
  });

  it("reads the country code in any case", () => {
    expect(requiresConsent("no", false)).toBe(true);
  });

  it("falls back to the detector's answer when the country is unknown", () => {
    expect(requiresConsent(undefined, true)).toBe(true);
    expect(requiresConsent(undefined, false)).toBe(false);
    expect(requiresConsent("", true)).toBe(true);
    // Cloudflare's unknown and Tor codes are no country (a custom detector passing them on).
    expect(requiresConsent("XX", true)).toBe(true);
    expect(requiresConsent("T1", true)).toBe(true);
  });
});
