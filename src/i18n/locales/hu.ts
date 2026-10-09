import type { Translations } from "../types";

export const hu: Translations = {
  banner: {
    title: "Hozzájárulás a sütikhez",
    message:
      "Sütiket használunk, hogy jobb élményt nyújtsunk. Elfogadhatja az összes sütit, vagy testre szabhatja a beállításait.",
    acceptAll: "Összes elfogadása",
    rejectAll: "Összes elutasítása",
    customize: "Testreszabás",
    privacyLinkText: "Adatvédelmi szabályzat",
  },
  preferenceCenter: {
    title: "Adatvédelmi beállítások",
    description:
      "Válassza ki, mely sütiket engedélyezi. Ezeket a beállításokat bármikor módosíthatja.",
    savePreferences: "Beállítások mentése",
    acceptAll: "Összes elfogadása",
    rejectAll: "Összes elutasítása",
    categories: {
      necessary: {
        name: "Feltétlenül szükséges",
        description:
          "Ezek a sütik elengedhetetlenek a weboldal megfelelő működéséhez. Nem kapcsolhatók ki.",
      },
      analytics: {
        name: "Statisztikai",
        description:
          "Ezek a sütik segítenek megérteni, hogyan használják a látogatók a weboldalunkat, az információk névtelen gyűjtésével és jelentésével.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Ezeket a sütiket a látogatók különböző weboldalakon való követésére használják, hogy releváns hirdetéseket jelenítsenek meg.",
      },
      functional: {
        name: "Funkcionális",
        description:
          "Ezek a sütik bővített funkciókat és személyre szabást tesznek lehetővé, például a nyelvi beállításokat.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
