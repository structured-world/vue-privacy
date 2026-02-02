import type { Translations } from "../types";

export const fr: Translations = {
  banner: {
    title: "Consentement aux cookies",
    message:
      "Nous utilisons des cookies pour améliorer votre expérience. Vous pouvez accepter tous les cookies ou personnaliser vos préférences.",
    acceptAll: "Tout accepter",
    rejectAll: "Tout refuser",
    customize: "Personnaliser",
    privacyLinkText: "Politique de confidentialité",
  },
  preferenceCenter: {
    title: "Préférences de confidentialité",
    description:
      "Choisissez les cookies que vous souhaitez autoriser. Vous pouvez modifier ces paramètres à tout moment.",
    savePreferences: "Enregistrer les préférences",
    acceptAll: "Tout accepter",
    categories: {
      necessary: {
        name: "Strictement nécessaires",
        description:
          "Ces cookies sont essentiels au bon fonctionnement du site web. Ils ne peuvent pas être désactivés.",
      },
      analytics: {
        name: "Analytiques",
        description:
          "Ces cookies nous aident à comprendre comment les visiteurs interagissent avec notre site web en collectant et en rapportant des informations de manière anonyme.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Ces cookies sont utilisés pour suivre les visiteurs sur les sites web afin d'afficher des publicités pertinentes.",
      },
      functional: {
        name: "Fonctionnels",
        description:
          "Ces cookies permettent des fonctionnalités améliorées et la personnalisation, comme les préférences linguistiques.",
      },
    },
  },
};
