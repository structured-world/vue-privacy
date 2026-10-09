import type { Translations } from "../types";

export const da: Translations = {
  banner: {
    title: "Samtykke til cookies",
    message:
      "Vi bruger cookies til at forbedre din oplevelse. Du kan acceptere alle cookies eller tilpasse dine præferencer.",
    acceptAll: "Accepter alle",
    rejectAll: "Afvis alle",
    customize: "Tilpas",
    privacyLinkText: "Privatlivspolitik",
  },
  preferenceCenter: {
    title: "Privatlivsindstillinger",
    description:
      "Vælg, hvilke cookies du vil tillade. Du kan til enhver tid ændre disse indstillinger.",
    savePreferences: "Gem præferencer",
    acceptAll: "Accepter alle",
    rejectAll: "Afvis alle",
    categories: {
      necessary: {
        name: "Strengt nødvendige",
        description:
          "Disse cookies er nødvendige for, at hjemmesiden fungerer korrekt. De kan ikke deaktiveres.",
      },
      analytics: {
        name: "Statistik",
        description:
          "Disse cookies hjælper os med at forstå, hvordan besøgende bruger vores hjemmeside, ved at indsamle og rapportere oplysninger anonymt.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Disse cookies bruges til at spore besøgende på tværs af hjemmesider for at vise relevante annoncer.",
      },
      functional: {
        name: "Funktionelle",
        description:
          "Disse cookies muliggør udvidet funktionalitet og personalisering, f.eks. sprogindstillinger.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
