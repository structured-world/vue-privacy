import type { Translations } from "../types";

export const ro: Translations = {
  banner: {
    title: "Consimțământ pentru cookie-uri",
    message:
      "Folosim cookie-uri pentru a vă îmbunătăți experiența. Puteți accepta toate cookie-urile sau vă puteți personaliza preferințele.",
    acceptAll: "Acceptă toate",
    rejectAll: "Respinge toate",
    customize: "Personalizează",
    privacyLinkText: "Politica de confidențialitate",
  },
  preferenceCenter: {
    title: "Preferințe de confidențialitate",
    description:
      "Alegeți ce cookie-uri doriți să permiteți. Puteți modifica aceste setări oricând.",
    savePreferences: "Salvează preferințele",
    acceptAll: "Acceptă toate",
    rejectAll: "Respinge toate",
    categories: {
      necessary: {
        name: "Strict necesare",
        description:
          "Aceste cookie-uri sunt esențiale pentru funcționarea corectă a site-ului. Nu pot fi dezactivate.",
      },
      analytics: {
        name: "Analiză",
        description:
          "Aceste cookie-uri ne ajută să înțelegem cum interacționează vizitatorii cu site-ul nostru, colectând și raportând informații în mod anonim.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Aceste cookie-uri sunt folosite pentru a urmări vizitatorii pe diferite site-uri, în scopul afișării de reclame relevante.",
      },
      functional: {
        name: "Funcționale",
        description:
          "Aceste cookie-uri permit funcționalități avansate și personalizare, cum ar fi preferințele de limbă.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
