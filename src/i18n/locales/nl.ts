import type { Translations } from "../types";

export const nl: Translations = {
  banner: {
    title: "Cookietoestemming",
    message:
      "We gebruiken cookies om uw ervaring te verbeteren. U kunt alle cookies accepteren of uw voorkeuren aanpassen.",
    acceptAll: "Alles accepteren",
    rejectAll: "Alles weigeren",
    customize: "Aanpassen",
    privacyLinkText: "Privacybeleid",
  },
  preferenceCenter: {
    title: "Privacyvoorkeuren",
    description:
      "Kies welke cookies u wilt toestaan. U kunt deze instellingen op elk moment wijzigen.",
    savePreferences: "Voorkeuren opslaan",
    acceptAll: "Alles accepteren",
    categories: {
      necessary: {
        name: "Strikt noodzakelijk",
        description:
          "Deze cookies zijn essentieel voor het goed functioneren van de website. Ze kunnen niet worden uitgeschakeld.",
      },
      analytics: {
        name: "Analytisch",
        description:
          "Deze cookies helpen ons te begrijpen hoe bezoekers omgaan met onze website door anoniem informatie te verzamelen en te rapporteren.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Deze cookies worden gebruikt om bezoekers over websites te volgen en relevante advertenties weer te geven.",
      },
      functional: {
        name: "Functioneel",
        description:
          "Deze cookies maken verbeterde functionaliteit en personalisatie mogelijk, zoals taalvoorkeuren.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
