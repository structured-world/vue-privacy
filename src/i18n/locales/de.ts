import type { Translations } from "../types";

export const de: Translations = {
  banner: {
    title: "Cookie-Einstellungen",
    message:
      "Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Sie können alle Cookies akzeptieren oder Ihre Einstellungen anpassen.",
    acceptAll: "Alle akzeptieren",
    rejectAll: "Alle ablehnen",
    customize: "Anpassen",
    privacyLinkText: "Datenschutzrichtlinie",
  },
  preferenceCenter: {
    title: "Datenschutzeinstellungen",
    description:
      "Wählen Sie aus, welche Cookies Sie zulassen möchten. Sie können diese Einstellungen jederzeit ändern.",
    savePreferences: "Einstellungen speichern",
    acceptAll: "Alle akzeptieren",
    categories: {
      necessary: {
        name: "Unbedingt erforderlich",
        description:
          "Diese Cookies sind für die ordnungsgemäße Funktion der Website unerlässlich. Sie können nicht deaktiviert werden.",
      },
      analytics: {
        name: "Analyse",
        description:
          "Diese Cookies helfen uns zu verstehen, wie Besucher mit unserer Website interagieren, indem sie Informationen anonym sammeln und melden.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Diese Cookies werden verwendet, um Besucher über Websites hinweg zu verfolgen und relevante Werbung anzuzeigen.",
      },
      functional: {
        name: "Funktional",
        description:
          "Diese Cookies ermöglichen erweiterte Funktionalität und Personalisierung, wie z. B. Spracheinstellungen.",
      },
    },
  },
};
