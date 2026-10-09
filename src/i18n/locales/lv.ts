import type { Translations } from "../types";

export const lv: Translations = {
  banner: {
    title: "Piekrišana sīkdatnēm",
    message:
      "Mēs izmantojam sīkdatnes, lai uzlabotu jūsu pieredzi. Varat pieņemt visas sīkdatnes vai pielāgot savas preferences.",
    acceptAll: "Pieņemt visas",
    rejectAll: "Noraidīt visas",
    customize: "Pielāgot",
    privacyLinkText: "Privātuma politika",
  },
  preferenceCenter: {
    title: "Privātuma iestatījumi",
    description:
      "Izvēlieties, kuras sīkdatnes vēlaties atļaut. Šos iestatījumus varat mainīt jebkurā laikā.",
    savePreferences: "Saglabāt preferences",
    acceptAll: "Pieņemt visas",
    rejectAll: "Noraidīt visas",
    categories: {
      necessary: {
        name: "Obligātās",
        description:
          "Šīs sīkdatnes ir nepieciešamas, lai tīmekļa vietne darbotos pareizi. Tās nevar atspējot.",
      },
      analytics: {
        name: "Analītikas",
        description:
          "Šīs sīkdatnes palīdz mums saprast, kā apmeklētāji izmanto mūsu tīmekļa vietni, anonīmi apkopojot un sniedzot informāciju.",
      },
      marketing: {
        name: "Mārketinga",
        description:
          "Šīs sīkdatnes tiek izmantotas, lai izsekotu apmeklētājus dažādās tīmekļa vietnēs un rādītu atbilstošas reklāmas.",
      },
      functional: {
        name: "Funkcionālās",
        description:
          "Šīs sīkdatnes nodrošina paplašinātu funkcionalitāti un personalizāciju, piemēram, valodas preferences.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
