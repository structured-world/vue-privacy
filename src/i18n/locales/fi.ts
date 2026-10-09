import type { Translations } from "../types";

export const fi: Translations = {
  banner: {
    title: "Evästesuostumus",
    message:
      "Käytämme evästeitä parantaaksemme käyttökokemustasi. Voit hyväksyä kaikki evästeet tai mukauttaa asetuksiasi.",
    acceptAll: "Hyväksy kaikki",
    rejectAll: "Hylkää kaikki",
    customize: "Mukauta",
    privacyLinkText: "Tietosuojaseloste",
  },
  preferenceCenter: {
    title: "Tietosuoja-asetukset",
    description:
      "Valitse, mitkä evästeet haluat sallia. Voit muuttaa näitä asetuksia milloin tahansa.",
    savePreferences: "Tallenna asetukset",
    acceptAll: "Hyväksy kaikki",
    rejectAll: "Hylkää kaikki",
    categories: {
      necessary: {
        name: "Välttämättömät",
        description:
          "Nämä evästeet ovat välttämättömiä sivuston asianmukaisen toiminnan kannalta. Niitä ei voi poistaa käytöstä.",
      },
      analytics: {
        name: "Analytiikka",
        description:
          "Nämä evästeet auttavat meitä ymmärtämään, miten kävijät käyttävät sivustoamme, keräämällä ja raportoimalla tietoja anonyymisti.",
      },
      marketing: {
        name: "Markkinointi",
        description:
          "Näitä evästeitä käytetään kävijöiden seuraamiseen eri sivustoilla osuvien mainosten näyttämiseksi.",
      },
      functional: {
        name: "Toiminnalliset",
        description:
          "Nämä evästeet mahdollistavat laajemmat toiminnot ja personoinnin, kuten kieliasetukset.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
