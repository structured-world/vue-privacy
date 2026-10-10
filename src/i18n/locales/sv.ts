import type { Translations } from "../types";

export const sv: Translations = {
  banner: {
    title: "Samtycke till cookies",
    message:
      "Vi använder cookies för att förbättra din upplevelse. Du kan godkänna alla cookies eller anpassa dina inställningar.",
    acceptAll: "Godkänn alla",
    rejectAll: "Avvisa alla",
    customize: "Anpassa",
    privacyLinkText: "Integritetspolicy",
  },
  preferenceCenter: {
    title: "Integritetsinställningar",
    description:
      "Välj vilka cookies du vill tillåta. Du kan ändra dessa inställningar när som helst.",
    savePreferences: "Spara inställningar",
    acceptAll: "Godkänn alla",
    rejectAll: "Avvisa alla",
    categories: {
      necessary: {
        name: "Strikt nödvändiga",
        description:
          "Dessa cookies är nödvändiga för att webbplatsen ska fungera korrekt. De kan inte inaktiveras.",
      },
      analytics: {
        name: "Statistik",
        description:
          "Dessa cookies hjälper oss att förstå hur besökare använder vår webbplats genom att samla in och rapportera information anonymt.",
      },
      marketing: {
        name: "Marknadsföring",
        description:
          "Dessa cookies används för att spåra besökare på olika webbplatser för att visa relevanta annonser.",
      },
      functional: {
        name: "Funktionella",
        description:
          "Dessa cookies möjliggör utökad funktionalitet och anpassning, till exempel språkinställningar.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
