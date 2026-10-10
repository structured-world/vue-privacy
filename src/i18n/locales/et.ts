import type { Translations } from "../types";

export const et: Translations = {
  banner: {
    title: "Küpsiste nõusolek",
    message:
      "Kasutame küpsiseid, et teie kogemust parandada. Võite nõustuda kõigi küpsistega või kohandada oma eelistusi.",
    acceptAll: "Nõustu kõigiga",
    rejectAll: "Keeldu kõigist",
    customize: "Kohanda",
    privacyLinkText: "Privaatsuspoliitika",
  },
  preferenceCenter: {
    title: "Privaatsusseaded",
    description: "Valige, milliseid küpsiseid soovite lubada. Neid seadeid saate igal ajal muuta.",
    savePreferences: "Salvesta eelistused",
    acceptAll: "Nõustu kõigiga",
    rejectAll: "Keeldu kõigist",
    categories: {
      necessary: {
        name: "Hädavajalikud",
        description:
          "Need küpsised on veebisaidi nõuetekohaseks toimimiseks hädavajalikud. Neid ei saa välja lülitada.",
      },
      analytics: {
        name: "Analüütika",
        description:
          "Need küpsised aitavad meil mõista, kuidas külastajad meie veebisaiti kasutavad, kogudes ja edastades teavet anonüümselt.",
      },
      marketing: {
        name: "Turundus",
        description:
          "Neid küpsiseid kasutatakse külastajate jälgimiseks erinevatel veebisaitidel, et näidata asjakohaseid reklaame.",
      },
      functional: {
        name: "Funktsionaalsed",
        description:
          "Need küpsised võimaldavad täiustatud funktsioone ja isikupärastamist, näiteks keele-eelistusi.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
