import type { Translations } from "../types";

export const sl: Translations = {
  banner: {
    title: "Soglasje za piškotke",
    message:
      "Piškotke uporabljamo za izboljšanje vaše izkušnje. Sprejmete lahko vse piškotke ali prilagodite svoje nastavitve.",
    acceptAll: "Sprejmi vse",
    rejectAll: "Zavrni vse",
    customize: "Prilagodi",
    privacyLinkText: "Pravilnik o zasebnosti",
  },
  preferenceCenter: {
    title: "Nastavitve zasebnosti",
    description:
      "Izberite, katere piškotke želite dovoliti. Te nastavitve lahko kadar koli spremenite.",
    savePreferences: "Shrani nastavitve",
    acceptAll: "Sprejmi vse",
    rejectAll: "Zavrni vse",
    categories: {
      necessary: {
        name: "Nujno potrebni",
        description:
          "Ti piškotki so nujni za pravilno delovanje spletnega mesta. Ni jih mogoče onemogočiti.",
      },
      analytics: {
        name: "Analitični",
        description:
          "Ti piškotki nam pomagajo razumeti, kako obiskovalci uporabljajo naše spletno mesto, tako da anonimno zbirajo in sporočajo podatke.",
      },
      marketing: {
        name: "Trženjski",
        description:
          "Ti piškotki se uporabljajo za sledenje obiskovalcem na različnih spletnih mestih, da se prikazujejo ustrezni oglasi.",
      },
      functional: {
        name: "Funkcionalni",
        description:
          "Ti piškotki omogočajo izboljšano delovanje in prilagajanje, na primer jezikovne nastavitve.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
