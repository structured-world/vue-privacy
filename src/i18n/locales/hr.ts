import type { Translations } from "../types";

export const hr: Translations = {
  banner: {
    title: "Privola za kolačiće",
    message:
      "Koristimo kolačiće kako bismo poboljšali vaše iskustvo. Možete prihvatiti sve kolačiće ili prilagoditi svoje postavke.",
    acceptAll: "Prihvati sve",
    rejectAll: "Odbij sve",
    customize: "Prilagodi",
    privacyLinkText: "Pravila privatnosti",
  },
  preferenceCenter: {
    title: "Postavke privatnosti",
    description:
      "Odaberite koje kolačiće želite dopustiti. Ove postavke možete promijeniti u bilo kojem trenutku.",
    savePreferences: "Spremi postavke",
    acceptAll: "Prihvati sve",
    rejectAll: "Odbij sve",
    categories: {
      necessary: {
        name: "Nužni",
        description: "Ovi su kolačići nužni za ispravan rad web-mjesta. Ne mogu se isključiti.",
      },
      analytics: {
        name: "Analitički",
        description:
          "Ovi nam kolačići pomažu razumjeti kako posjetitelji koriste naše web-mjesto tako što anonimno prikupljaju i izvještavaju o podacima.",
      },
      marketing: {
        name: "Marketinški",
        description:
          "Ovi se kolačići koriste za praćenje posjetitelja na različitim web-mjestima radi prikazivanja relevantnih oglasa.",
      },
      functional: {
        name: "Funkcionalni",
        description:
          "Ovi kolačići omogućuju naprednu funkcionalnost i personalizaciju, primjerice jezične postavke.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
