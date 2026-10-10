import type { Translations } from "../types";

export const lt: Translations = {
  banner: {
    title: "Sutikimas su slapukais",
    message:
      "Naudojame slapukus, kad pagerintume jūsų patirtį. Galite sutikti su visais slapukais arba pritaikyti savo nuostatas.",
    acceptAll: "Priimti visus",
    rejectAll: "Atmesti visus",
    customize: "Tinkinti",
    privacyLinkText: "Privatumo politika",
  },
  preferenceCenter: {
    title: "Privatumo nuostatos",
    description:
      "Pasirinkite, kuriuos slapukus norite leisti. Šias nuostatas galite bet kada pakeisti.",
    savePreferences: "Išsaugoti nuostatas",
    acceptAll: "Priimti visus",
    rejectAll: "Atmesti visus",
    categories: {
      necessary: {
        name: "Būtinieji",
        description: "Šie slapukai būtini, kad svetainė veiktų tinkamai. Jų negalima išjungti.",
      },
      analytics: {
        name: "Analitiniai",
        description:
          "Šie slapukai padeda mums suprasti, kaip lankytojai naudojasi mūsų svetaine, anonimiškai renkant ir teikiant informaciją.",
      },
      marketing: {
        name: "Rinkodaros",
        description:
          "Šie slapukai naudojami lankytojams sekti įvairiose svetainėse, kad būtų rodomos aktualios reklamos.",
      },
      functional: {
        name: "Funkciniai",
        description:
          "Šie slapukai suteikia išplėstines funkcijas ir personalizavimą, pavyzdžiui, kalbos nuostatas.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
