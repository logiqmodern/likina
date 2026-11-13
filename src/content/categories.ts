import type { Lang } from "@/i18n";

/*
 * Copy for the four categories: hero slides on the home page, the intro on
 * each category page and its meta description (SEO/GEO). Facts only from the
 * catalogue: who paints what, materials named in the artwork descriptions.
 */

export interface CategoryCopy {
  name: string;
  /** hero slide */
  eyebrow: string;
  headline: string;
  text: string;
  cta: string;
  /** category page */
  intro: string;
  metaTitle: string;
  metaDescription: string;
}

export const CATEGORY_COPY: Record<string, Record<Lang, CategoryCopy>> = {
  ikoni: {
    bg: {
      name: "Икони",
      eyebrow: "Ръчно изписани икони",
      headline: "Икони, изписани изцяло на ръка",
      text: "Яйчна темпера, левкас и 23-каратово злато върху дърво — православни икони от зограф Гергана Никифорова.",
      cta: "Разгледайте иконите",
      intro:
        "Оригинални православни икони, изписани изцяло на ръка от зограф Гергана Никифорова в традиционната техника — яйчна темпера и позлата върху дървена основа с левкас. Всяка икона е уникат. Изписваме и икони по поръчка.",
      metaTitle: "Ръчно рисувани икони — купете оригинална икона",
      metaDescription:
        "Оригинални православни икони, ръчно изписани с яйчна темпера и 23-каратово злато от зограф Гергана Никифорова. Безплатна доставка в България.",
    },
    en: {
      name: "Icons",
      eyebrow: "Hand-painted icons",
      headline: "Icons painted entirely by hand",
      text: "Egg tempera, gesso and 23-carat gold on wood — Orthodox icons by icon painter Gergana Nikiforova.",
      cta: "Browse the icons",
      intro:
        "Original Orthodox icons painted entirely by hand by icon painter Gergana Nikiforova in the traditional technique — egg tempera and gilding on a gessoed wooden panel. Every icon is one of a kind. Icons are also painted to order.",
      metaTitle: "Hand-painted Orthodox icons — buy an original icon",
      metaDescription:
        "Original Orthodox icons hand-painted with egg tempera and 23-carat gold by icon painter Gergana Nikiforova. Free delivery within Bulgaria.",
    },
  },
  "kartini-sas-zlato": {
    bg: {
      name: "Картини със злато",
      eyebrow: "Картини със злато",
      headline: "Природа, в която златото оживява",
      text: "Пейзажи, цветя, птици и натюрморти на Гергана Никифорова — с истинско злато и много детайл.",
      cta: "Разгледайте картините",
      intro:
        "Пейзажи, натюрморти, цветя и животни на Гергана Никифорова, рисувани на ръка и допълнени със злато. Всяка картина е оригинал в един екземпляр.",
      metaTitle: "Картини със злато — оригинални картини на ръка",
      metaDescription:
        "Оригинални картини със злато — пейзажи, цветя, птици и натюрморти, рисувани на ръка от Гергана Никифорова. Безплатна доставка в България.",
    },
    en: {
      name: "Gold paintings",
      eyebrow: "Paintings with gold",
      headline: "Nature brought to life with gold",
      text: "Landscapes, flowers, birds and still lifes by Gergana Nikiforova — with real gold and fine detail.",
      cta: "Browse the paintings",
      intro:
        "Landscapes, still lifes, flowers and animals by Gergana Nikiforova, painted by hand and finished with gold. Every painting is a single original.",
      metaTitle: "Paintings with gold — original hand-painted art",
      metaDescription:
        "Original paintings with gold — landscapes, flowers, birds and still lifes hand-painted by Gergana Nikiforova. Free delivery within Bulgaria.",
    },
  },
  "abstraktni-kartini": {
    bg: {
      name: "Абстрактни картини",
      eyebrow: "Абстрактно изкуство",
      headline: "Цвят, форма и движение",
      text: "Абстрактни картини на Румен Божинов — оригинали, които променят атмосферата на всяко пространство.",
      cta: "Разгледайте абстракциите",
      intro: "Оригинални абстрактни картини на художника Румен Божинов. Всяка творба е уникат, рисуван на ръка.",
      metaTitle: "Абстрактни картини — оригинали от Румен Божинов",
      metaDescription: "Оригинални абстрактни картини на художника Румен Божинов. Уникати, рисувани на ръка. Безплатна доставка в България.",
    },
    en: {
      name: "Abstract paintings",
      eyebrow: "Abstract art",
      headline: "Colour, form and movement",
      text: "Abstract paintings by Rumen Bozhinov — originals that change the mood of any room.",
      cta: "Browse the abstracts",
      intro: "Original abstract paintings by the artist Rumen Bozhinov. Every work is one of a kind, painted by hand.",
      metaTitle: "Abstract paintings — originals by Rumen Bozhinov",
      metaDescription: "Original abstract paintings by the artist Rumen Bozhinov. One-of-a-kind, painted by hand. Free delivery within Bulgaria.",
    },
  },
  "art-printove": {
    bg: {
      name: "Арт принтове",
      eyebrow: "Арт принтове",
      headline: "Авторски принтове с ръчна позлата",
      text: "Принтове на творби на Гергана Никифорова върху арт хартия, допълнени със злато на ръка.",
      cta: "Разгледайте принтовете",
      intro: "Авторски арт принтове на творби на Гергана Никифорова върху матова арт хартия, с ръчна позлата. Достъпен начин да имате нейно изкуство у дома.",
      metaTitle: "Арт принтове с ръчна позлата",
      metaDescription: "Авторски арт принтове на Гергана Никифорова върху арт хартия, с ръчна позлата. Безплатна доставка в България.",
    },
    en: {
      name: "Art prints",
      eyebrow: "Art prints",
      headline: "Art prints with hand gilding",
      text: "Prints of works by Gergana Nikiforova on art paper, finished with gold by hand.",
      cta: "Browse the prints",
      intro: "Art prints of works by Gergana Nikiforova on matte art paper, gilded by hand. An accessible way to bring her art home.",
      metaTitle: "Art prints with hand gilding",
      metaDescription: "Art prints of works by Gergana Nikiforova on art paper, gilded by hand. Free delivery within Bulgaria.",
    },
  },
};
