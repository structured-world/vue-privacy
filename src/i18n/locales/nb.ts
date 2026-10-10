import type { Translations } from "../types";

export const nb: Translations = {
  banner: {
    title: "Samtykke til informasjonskapsler",
    message:
      "Vi bruker informasjonskapsler for å forbedre opplevelsen din. Du kan godta alle informasjonskapsler eller tilpasse innstillingene dine.",
    acceptAll: "Godta alle",
    rejectAll: "Avvis alle",
    customize: "Tilpass",
    privacyLinkText: "Personvernerklæring",
  },
  preferenceCenter: {
    title: "Personverninnstillinger",
    description:
      "Velg hvilke informasjonskapsler du vil tillate. Du kan endre disse innstillingene når som helst.",
    savePreferences: "Lagre innstillinger",
    acceptAll: "Godta alle",
    rejectAll: "Avvis alle",
    categories: {
      necessary: {
        name: "Strengt nødvendige",
        description:
          "Disse informasjonskapslene er nødvendige for at nettstedet skal fungere som det skal. De kan ikke slås av.",
      },
      analytics: {
        name: "Statistikk",
        description:
          "Disse informasjonskapslene hjelper oss å forstå hvordan besøkende bruker nettstedet vårt, ved å samle inn og rapportere informasjon anonymt.",
      },
      marketing: {
        name: "Markedsføring",
        description:
          "Disse informasjonskapslene brukes til å spore besøkende på tvers av nettsteder for å vise relevante annonser.",
      },
      functional: {
        name: "Funksjonelle",
        description:
          "Disse informasjonskapslene gir utvidet funksjonalitet og tilpasning, for eksempel språkinnstillinger.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
