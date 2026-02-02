import type { Translations } from "../types";

export const it: Translations = {
  banner: {
    title: "Consenso ai cookie",
    message:
      "Utilizziamo i cookie per migliorare la tua esperienza. Puoi accettare tutti i cookie o personalizzare le tue preferenze.",
    acceptAll: "Accetta tutto",
    rejectAll: "Rifiuta tutto",
    customize: "Personalizza",
    privacyLinkText: "Informativa sulla privacy",
  },
  preferenceCenter: {
    title: "Preferenze sulla privacy",
    description:
      "Scegli quali cookie desideri consentire. Puoi modificare queste impostazioni in qualsiasi momento.",
    savePreferences: "Salva preferenze",
    acceptAll: "Accetta tutto",
    categories: {
      necessary: {
        name: "Strettamente necessari",
        description:
          "Questi cookie sono essenziali per il corretto funzionamento del sito web. Non possono essere disattivati.",
      },
      analytics: {
        name: "Analitici",
        description:
          "Questi cookie ci aiutano a capire come i visitatori interagiscono con il nostro sito web raccogliendo e riportando informazioni in modo anonimo.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Questi cookie vengono utilizzati per tracciare i visitatori sui siti web al fine di mostrare pubblicità pertinenti.",
      },
      functional: {
        name: "Funzionali",
        description:
          "Questi cookie consentono funzionalità avanzate e personalizzazione, come le preferenze linguistiche.",
      },
    },
  },
};
