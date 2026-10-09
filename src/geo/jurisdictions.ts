/**
 * Jurisdictions whose law requires consent before non-essential cookies or tracking, and the
 * countries (ISO 3166-1 alpha-2, as IP geolocation reports them) each one covers.
 *
 * - `EEA`: the EU member states, where the GDPR and the ePrivacy Directive (2002/58/EC,
 *   Art. 5(3)) apply, including the outermost regions and Åland, which IP geolocation reports
 *   under their own codes; and Iceland, Liechtenstein and Norway, where they apply through the
 *   EEA Agreement.
 * - `UK`: the UK GDPR and PECR regulation 6.
 * - `CH`: Switzerland (revised FADP); not on by default.
 */
export type ConsentJurisdiction = "EEA" | "UK" | "CH";

export const JURISDICTION_COUNTRIES: Readonly<Record<ConsentJurisdiction, readonly string[]>> = {
  EEA: [
    // EU member states
    "AT",
    "BE",
    "BG",
    "CY",
    "CZ",
    "DE",
    "DK",
    "EE",
    "ES",
    "FI",
    "FR",
    "GR",
    "HR",
    "HU",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SE",
    "SI",
    "SK",
    // Parts of the EU with their own codes: Åland, French Guiana, Guadeloupe, Martinique,
    // Réunion, Mayotte, Saint-Martin (TFEU Art. 349 and 355)
    "AX",
    "GF",
    "GP",
    "MQ",
    "RE",
    "YT",
    "MF",
    // EEA EFTA states
    "IS",
    "LI",
    "NO",
  ],
  UK: ["GB"],
  CH: ["CH"],
};

/** The jurisdictions that require consent unless `consentJurisdictions` says otherwise. */
export const DEFAULT_CONSENT_JURISDICTIONS: readonly ConsentJurisdiction[] = ["EEA", "UK"];

/** The countries the given jurisdictions cover. */
export function consentCountries(
  jurisdictions: readonly ConsentJurisdiction[] = DEFAULT_CONSENT_JURISDICTIONS
): ReadonlySet<string> {
  return new Set(jurisdictions.flatMap((jurisdiction) => JURISDICTION_COUNTRIES[jurisdiction]));
}

/**
 * IANA time zones of every country in {@link JURISDICTION_COUNTRIES}, mapped to that country:
 * the `zone.tab` rows of those countries, plus the `backward` names some systems still report
 * (`Europe/Nicosia`, `GB`, `Eire`). A test checks it against the tz database.
 */
export const TIMEZONE_COUNTRIES: Readonly<Record<string, string>> = {
  "Africa/Ceuta": "ES",
  "America/Cayenne": "GF",
  "America/Guadeloupe": "GP",
  "America/Marigot": "MF",
  "America/Martinique": "MQ",
  "Asia/Famagusta": "CY",
  "Asia/Nicosia": "CY",
  "Atlantic/Azores": "PT",
  "Atlantic/Canary": "ES",
  "Atlantic/Madeira": "PT",
  "Atlantic/Reykjavik": "IS",
  "Europe/Amsterdam": "NL",
  "Europe/Athens": "GR",
  "Europe/Berlin": "DE",
  "Europe/Bratislava": "SK",
  "Europe/Brussels": "BE",
  "Europe/Bucharest": "RO",
  "Europe/Budapest": "HU",
  "Europe/Busingen": "DE",
  "Europe/Copenhagen": "DK",
  "Europe/Dublin": "IE",
  "Europe/Helsinki": "FI",
  "Europe/Lisbon": "PT",
  "Europe/Ljubljana": "SI",
  "Europe/London": "GB",
  "Europe/Luxembourg": "LU",
  "Europe/Madrid": "ES",
  "Europe/Malta": "MT",
  "Europe/Mariehamn": "AX",
  "Europe/Oslo": "NO",
  "Europe/Paris": "FR",
  "Europe/Prague": "CZ",
  "Europe/Riga": "LV",
  "Europe/Rome": "IT",
  "Europe/Sofia": "BG",
  "Europe/Stockholm": "SE",
  "Europe/Tallinn": "EE",
  "Europe/Vaduz": "LI",
  "Europe/Vienna": "AT",
  "Europe/Vilnius": "LT",
  "Europe/Warsaw": "PL",
  "Europe/Zagreb": "HR",
  "Europe/Zurich": "CH",
  "Indian/Mayotte": "YT",
  "Indian/Reunion": "RE",
  // Backward-compatible names
  Eire: "IE",
  "Europe/Belfast": "GB",
  "Europe/Nicosia": "CY",
  GB: "GB",
  "GB-Eire": "GB",
  Iceland: "IS",
  Poland: "PL",
  Portugal: "PT",
};

/**
 * Whether a visitor needs to be asked for consent. A known country decides; without one, the
 * detector's own answer stands.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code, any case, or undefined when unknown
 * @param detected - The detector's answer, used only when the country is unknown
 * @param jurisdictions - The jurisdictions that require consent
 */
export function requiresConsent(
  countryCode: string | undefined,
  detected: boolean,
  jurisdictions: readonly ConsentJurisdiction[] = DEFAULT_CONSENT_JURISDICTIONS
): boolean {
  if (!countryCode) return detected;
  return consentCountries(jurisdictions).has(countryCode.toUpperCase());
}
