import type { Translations } from "../types";

export const is: Translations = {
  banner: {
    title: "Samþykki fyrir vafrakökum",
    message:
      "Við notum vafrakökur til að bæta upplifun þína. Þú getur samþykkt allar vafrakökur eða sérsniðið stillingarnar þínar.",
    acceptAll: "Samþykkja allar",
    rejectAll: "Hafna öllum",
    customize: "Sérsníða",
    privacyLinkText: "Persónuverndarstefna",
  },
  preferenceCenter: {
    title: "Persónuverndarstillingar",
    description:
      "Veldu hvaða vafrakökur þú vilt leyfa. Þú getur breytt þessum stillingum hvenær sem er.",
    savePreferences: "Vista stillingar",
    acceptAll: "Samþykkja allar",
    rejectAll: "Hafna öllum",
    categories: {
      necessary: {
        name: "Nauðsynlegar",
        description:
          "Þessar vafrakökur eru nauðsynlegar til að vefsvæðið virki rétt. Ekki er hægt að slökkva á þeim.",
      },
      analytics: {
        name: "Tölfræði",
        description:
          "Þessar vafrakökur hjálpa okkur að skilja hvernig gestir nota vefsvæðið okkar með því að safna og skýra frá upplýsingum á nafnlausan hátt.",
      },
      marketing: {
        name: "Markaðssetning",
        description:
          "Þessar vafrakökur eru notaðar til að fylgjast með gestum á milli vefsvæða í þeim tilgangi að birta viðeigandi auglýsingar.",
      },
      functional: {
        name: "Virkni",
        description:
          "Þessar vafrakökur gera aukna virkni og sérsnið möguleg, til dæmis tungumálastillingar.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
