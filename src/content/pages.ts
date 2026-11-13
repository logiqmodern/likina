import type { Lang, StaticPage } from "@/i18n";

/*
 * Copy of the static pages (§8). Facts only from the old site and the client's
 * decisions (docs/PROMPT.md §20). Legal pages are drafts until a lawyer checks
 * them (TODO-CLIENT, OPEN-QUESTIONS Q14). HTML is ours — no user input.
 */

export interface PageCopy {
  title: string;
  description: string;
  lead?: string;
  html: string;
}

type CopyPages = Exclude<StaticPage, "home" | "gallery" | "cart" | "checkout">;

const LEGAL_DRAFT = {
  bg: '<p class="todo-chip">TODO-CLIENT: чернова — да се прегледа от юрист преди старта</p>',
  en: '<p class="todo-chip">TODO-CLIENT: draft — to be reviewed by a lawyer before launch</p>',
};

const SELLER_BG = `<p><strong>Гергана Руменова Никифорова</strong>, занаятчия<br>ЕИК 177641226 (не е регистрирана по ДДС)<br>Седалище и адрес: гр. София, бул. Свети Наум 66<br>Телефон: +359 899 857 525 · Имейл: iconslikina@gmail.com</p>`;
const SELLER_EN = `<p><strong>Gergana Rumenova Nikiforova</strong>, craftsperson<br>Company ID (EIK) 177641226 (not VAT-registered)<br>Registered address: 66 Sveti Naum Blvd., Sofia, Bulgaria<br>Phone: +359 899 857 525 · E-mail: iconslikina@gmail.com</p>`;

export const PAGES: Record<CopyPages, Record<Lang, PageCopy>> = {
  about: {
    bg: {
      title: "За ателието",
      description: "Семейно ателие Ликина — икони и картини на Гергана Никифорова и Румен Божинов, баща и дъщеря.",
      lead: "Семейно ателие Ликина",
      html: `<p>Добре дошли в нашия малък, пъстър и изпълнен с емоции свят! Галерия Ликина не е просто място, където се продават картини — това е нашето творческо пространство, нашето работно място и сърцето на нашето изкуство. Тук представяме ексклузивно творбите на двама автори: баща и дъщеря, обединени от любовта към изящното.</p><p>Всеки, който е привлечен от нашето изкуство и иска да се докосне до процеса на създаване, е добре дошъл да ни посети на място в София — по предварителна уговорка.</p>`,
    },
    en: {
      title: "About the atelier",
      description: "Likina family atelier — icons and paintings by Gergana Nikiforova and Rumen Bozhinov, daughter and father.",
      lead: "Likina family atelier",
      html: `<p>Welcome to our small, colourful world full of emotion! The Likina gallery is not just a place where paintings are sold — it is our creative space, our workplace and the heart of our art. Here we show exclusively the works of two artists: a father and a daughter, united by their love of fine art.</p><p>Anyone drawn to our art who wants to see how it is made is welcome to visit us in Sofia — by appointment.</p>`,
    },
  },
  customIcon: {
    bg: {
      title: "Икона по поръчка",
      description: "Ръчно изписана икона на избран от Вас светия или образ. Цената и срокът са по договаряне.",
      lead: "Изписваме икона на избран от Вас светия или образ — изцяло на ръка, в техниката, в която са рисувани иконите в магазина.",
      html: `<h2>Как протича</h2><ul><li>Пишете ни кой светия или образ желаете, приблизителен размер и срок.</li><li>Свързваме се с Вас, уточняваме детайлите и Ви предлагаме цена и срок.</li><li>След като се договорим, започваме работа и Ви държим в течение.</li></ul><p>Цената и срокът са по договаряне според размера и сложността на образа.</p><p>Иконите, изработени по поръчка, не подлежат на връщане (изключение от правото на отказ по Закона за защита на потребителите).</p>`,
    },
    en: {
      title: "Custom icon",
      description: "A hand-painted icon of the saint or image of your choice. Price and timing by agreement.",
      lead: "We paint an icon of the saint or image of your choice — entirely by hand, in the same technique as the icons in the gallery.",
      html: `<h2>How it works</h2><ul><li>Tell us which saint or image you would like, the approximate size and timing.</li><li>We get in touch, discuss the details and offer you a price and timing.</li><li>Once we agree, we start painting and keep you updated.</li></ul><p>Price and timing are by agreement, depending on the size and complexity of the image.</p><p>Icons made to order cannot be returned (an exception to the right of withdrawal under consumer law).</p>`,
    },
  },
  contact: {
    bg: {
      title: "Контакти",
      description: "Свържете се с ателие Ликина — телефон, имейл и адрес в София.",
      lead: "Ако дадена картина е привлякла вниманието Ви, искате да обсъдим икона по поръчка или просто търсите съвет — ще се радваме да се чуем. Обадете ни се или заповядайте в ателието, за да видите творбите на живо.",
      html: "",
    },
    en: {
      title: "Contact",
      description: "Get in touch with the Likina atelier — phone, e-mail and address in Sofia.",
      lead: "If a painting has caught your eye, you would like to discuss a custom icon, or you are simply looking for advice — we would be happy to hear from you. Call us or visit the atelier to see the works in person.",
      html: "",
    },
  },
  shipping: {
    bg: {
      title: "Доставка и връщане",
      description: "Безплатна доставка с Еконт в България, изпращане до 2–3 работни дни, застрахована пратка, 14 дни право на връщане.",
      html: `<h2>Доставка</h2><ul><li>Доставяме само в България, с куриерска фирма Еконт — до офис, до адрес или до Еконтомат.</li><li>Доставката е <strong>безплатна</strong> — включена е в цената на творбата.</li><li>Изпращаме до 2–3 работни дни след потвърждение на поръчката.</li><li>Всяка пратка е застрахована с обявена стойност, равна на стойността на поръчката.</li><li>Можете да вземете поръчката и от ателието в София (ж.к. Лозенец, ул. Милин камък 12) с 5% отстъпка — ще се свържем с Вас за удобен час.</li></ul><h2>Плащане</h2><ul><li>С карта (myPOS) при поръчката.</li><li>Наложен платеж — плащате на куриера при получаване.</li><li>При вземане от ателието — плащане на място.</li></ul><h2>Право на отказ и връщане</h2><p>Имате право да се откажете от покупката в срок от 14 календарни дни от получаването, без да посочвате причина. Творбата трябва да бъде върната в оригиналния си вид, без следи от употреба и без повреди по рамката. Разходите за връщане са за Ваша сметка, освен при дефект или грешно изпратена творба.</p><p>Правото на отказ не се прилага за творби, изработени по индивидуална поръчка (например икона по поръчка).</p><p>Сумата се възстановява до 14 дни след получаване на върнатата творба — при плащане с карта чрез обратна операция по същата карта.</p><p>За отказ ни пишете на iconslikina@gmail.com или се обадете на +359 899 857 525.</p>`,
    },
    en: {
      title: "Shipping and returns",
      description: "Free delivery with Econt within Bulgaria, dispatch within 2–3 working days, insured parcel, 14-day right of withdrawal.",
      html: `<h2>Delivery</h2><ul><li>We deliver within Bulgaria only, with the courier Econt — to an office, an address or an Econtomat locker.</li><li>Delivery is <strong>free</strong> — it is included in the price of the artwork.</li><li>We dispatch within 2–3 working days after the order is confirmed.</li><li>Every parcel is insured with a declared value equal to the order value.</li><li>You can also collect your order from the atelier in Sofia (Lozenets, 12 Milin Kamak St.) with a 5% discount — we will contact you to arrange a time.</li></ul><h2>Payment</h2><ul><li>By card (myPOS) when ordering.</li><li>Cash on delivery — pay the courier on receipt.</li><li>Atelier pick-up — pay on site.</li></ul><h2>Right of withdrawal and returns</h2><p>You may withdraw from the purchase within 14 calendar days of receipt without giving a reason. The artwork must be returned in its original condition, unused and with an undamaged frame. Return costs are yours, except for a defect or a wrongly sent artwork.</p><p>The right of withdrawal does not apply to works made to order (for example a custom icon).</p><p>We refund within 14 days of receiving the returned artwork — for card payments by a refund to the same card.</p><p>To withdraw, write to iconslikina@gmail.com or call +359 899 857 525.</p>`,
    },
  },
  faq: {
    bg: {
      title: "Често задавани въпроси",
      description: "Доставка, плащане, връщане, икони по поръчка и посещение на ателието.",
      html: `<h2>Колко струва доставката?</h2><p>Доставката с Еконт в България е безплатна — включена е в цената.</p><h2>Кога ще получа творбата?</h2><p>Изпращаме до 2–3 работни дни след потвърждение на поръчката; Еконт доставя обикновено за 1–3 работни дни.</p><h2>Доставяте ли извън България?</h2><p>Засега доставяме само в България. Ако сте в чужбина, пишете ни.</p><h2>Как мога да платя?</h2><p>С карта (myPOS) при поръчката, с наложен платеж или на място при вземане от ателието.</p><h2>Пратката застрахована ли е?</h2><p>Да — всяка пратка е с обявена стойност, равна на стойността на поръчката.</p><h2>Мога ли да върна творба?</h2><p>Да, в 14-дневен срок от получаването, в оригиналния ѝ вид. Изключение са творбите по индивидуална поръчка. Подробности — на страницата „Доставка и връщане“.</p><h2>Рисувате ли икони по поръчка?</h2><p>Да. Пишете ни кой светия или образ желаете; цената и срокът са по договаряне.</p><h2>Мога ли да видя творбите на живо?</h2><p>Да — в ателието в София, ж.к. Лозенец, ул. Милин камък 12, по предварителна уговорка.</p><h2>Мога ли да взема поръчката от ателието?</h2><p>Да, с 5% отстъпка. Изберете „Вземане от ателието“ при поръчката и ще се свържем с Вас.</p><h2>Издавате ли фактура?</h2><p>Да — отбележете „Искам фактура“ при поръчката. Продавачът не е регистриран по ДДС.</p>`,
    },
    en: {
      title: "Frequently asked questions",
      description: "Delivery, payment, returns, custom icons and visiting the atelier.",
      html: `<h2>How much is delivery?</h2><p>Delivery with Econt within Bulgaria is free — it is included in the price.</p><h2>When will I receive the artwork?</h2><p>We dispatch within 2–3 working days after the order is confirmed; Econt usually delivers within 1–3 working days.</p><h2>Do you ship outside Bulgaria?</h2><p>For now we deliver within Bulgaria only. If you are abroad, please write to us.</p><h2>How can I pay?</h2><p>By card (myPOS) when ordering, cash on delivery, or on site when collecting from the atelier.</p><h2>Is the parcel insured?</h2><p>Yes — every parcel has a declared value equal to the order value.</p><h2>Can I return an artwork?</h2><p>Yes, within 14 days of receipt, in its original condition. Works made to order are an exception. Details on the Shipping and returns page.</p><h2>Do you paint icons to order?</h2><p>Yes. Tell us which saint or image you would like; price and timing are by agreement.</p><h2>Can I see the works in person?</h2><p>Yes — at the atelier in Sofia, Lozenets, 12 Milin Kamak St., by appointment.</p><h2>Can I collect my order from the atelier?</h2><p>Yes, with a 5% discount. Choose “Pick-up from the atelier” at checkout and we will contact you.</p><h2>Do you issue invoices?</h2><p>Yes — tick “I need an invoice” at checkout. The seller is not VAT-registered.</p>`,
    },
  },
  terms: {
    bg: {
      title: "Общи условия",
      description: "Общи условия за покупка от likina.com.",
      html: `${LEGAL_DRAFT.bg}<p>Настоящите Общи условия регулират отношенията между продавача и потребителите на likina.com.</p><h2>Продавач</h2>${SELLER_BG}<h2>Цени</h2><p>Цените са крайни, в евро (EUR), и включват доставката с Еконт в България. Продавачът не е регистриран по ДДС.</p><h2>Поръчка</h2><p>Поръчката се прави без регистрация. Тя е приета, когато получите потвърждение по имейл. При плащане с карта творбата е запазена за Вас 15 минути, докато плащането завърши.</p><h2>Плащане</h2><p>С карта чрез myPOS Checkout, с наложен платеж или на място при вземане от ателието.</p><h2>Доставка</h2><p>Само в България, с Еконт, до 2–3 работни дни след потвърждение. Пратките са застраховани с обявена стойност.</p><h2>Право на отказ</h2><p>Имате право да се откажете в срок от 14 календарни дни от получаването. Изключение: творби, изработени по индивидуална поръчка. Подробности — „Доставка и връщане“.</p><h2>Авторски права</h2><p>Всички изображения на картини, икони и текстове в сайта са обект на авторско право на Гергана Никифорова и Румен Божинов.</p><h2>Спорове</h2><p>Спорове се решават по взаимно съгласие, а при невъзможност — от компетентния български съд. Можете да използвате и платформата за онлайн решаване на спорове: https://ec.europa.eu/consumers/odr.</p>`,
    },
    en: {
      title: "Terms and conditions",
      description: "Terms and conditions for purchases on likina.com.",
      html: `${LEGAL_DRAFT.en}<p>These Terms govern the relationship between the seller and the users of likina.com.</p><h2>Seller</h2>${SELLER_EN}<h2>Prices</h2><p>Prices are final, in euro (EUR), and include delivery with Econt within Bulgaria. The seller is not VAT-registered.</p><h2>Orders</h2><p>No account is needed. An order is accepted when you receive a confirmation by e-mail. When paying by card, the artwork is reserved for you for 15 minutes while the payment completes.</p><h2>Payment</h2><p>By card via myPOS Checkout, cash on delivery, or on site when collecting from the atelier.</p><h2>Delivery</h2><p>Within Bulgaria only, with Econt, within 2–3 working days after confirmation. Parcels are insured with a declared value.</p><h2>Right of withdrawal</h2><p>You may withdraw within 14 calendar days of receipt. Exception: works made to order. Details on the Shipping and returns page.</p><h2>Copyright</h2><p>All images of paintings, icons and texts on this website are protected by the copyright of Gergana Nikiforova and Rumen Bozhinov.</p><h2>Disputes</h2><p>Disputes are settled by mutual agreement or, failing that, by the competent Bulgarian court. You may also use the EU online dispute resolution platform: https://ec.europa.eu/consumers/odr.</p>`,
    },
  },
  privacy: {
    bg: {
      title: "Поверителност",
      description: "Как likina.com обработва личните Ви данни.",
      html: `${LEGAL_DRAFT.bg}<h2>Администратор на данните</h2>${SELLER_BG}<h2>Какви данни събираме и защо</h2><ul><li><strong>Поръчки:</strong> име, имейл, телефон, адрес или офис за доставка, данни за фактура (ако поискате) — за да изпълним поръчката и да издадем документи (договор, законово задължение).</li><li><strong>Запитвания:</strong> данните от формата — за да Ви отговорим.</li><li><strong>Плащане с карта:</strong> данните за картата се въвеждат на страницата на myPOS; ние не ги получаваме.</li><li><strong>Анализ и реклама:</strong> само с Вашето съгласие (вижте „Бисквитки“).</li></ul><h2>Получатели</h2><p>Еконт (доставка), myPOS (плащане), доставчици на хостинг и имейл, които обработват данни от наше име.</p><h2>Срок</h2><p>Данните за поръчки се пазят толкова, колкото изисква счетоводното законодателство; запитванията — до 5 години.</p><h2>Вашите права</h2><p>Достъп, коригиране, изтриване, ограничаване, възражение и преносимост. Пишете на iconslikina@gmail.com. Имате право на жалба до Комисията за защита на личните данни (www.cpdp.bg).</p>`,
    },
    en: {
      title: "Privacy",
      description: "How likina.com processes your personal data.",
      html: `${LEGAL_DRAFT.en}<h2>Data controller</h2>${SELLER_EN}<h2>What we collect and why</h2><ul><li><strong>Orders:</strong> name, e-mail, phone, delivery address or office, invoice details (if requested) — to fulfil the order and issue documents (contract, legal obligation).</li><li><strong>Enquiries:</strong> the form data — to reply to you.</li><li><strong>Card payments:</strong> card details are entered on the myPOS page; we never receive them.</li><li><strong>Analytics and advertising:</strong> only with your consent (see Cookies).</li></ul><h2>Recipients</h2><p>Econt (delivery), myPOS (payment), hosting and e-mail providers processing data on our behalf.</p><h2>Retention</h2><p>Order data is kept as long as accounting law requires; enquiries up to 5 years.</p><h2>Your rights</h2><p>Access, rectification, erasure, restriction, objection and portability. Write to iconslikina@gmail.com. You may lodge a complaint with the Bulgarian Commission for Personal Data Protection (www.cpdp.bg).</p>`,
    },
  },
  cookies: {
    bg: {
      title: "Бисквитки",
      description: "Какви бисквитки използва likina.com.",
      html: `${LEGAL_DRAFT.bg}<h2>Необходими</h2><p>Количката (<code>likina_cart</code>) и защитата на формите — без тях сайтът не работи. Не изискват съгласие.</p><h2>Анализ и реклама</h2><p>Google Analytics и Meta Pixel се зареждат само ако ги разрешите в банера за бисквитки. Можете да промените избора си по всяко време.</p>`,
    },
    en: {
      title: "Cookies",
      description: "Which cookies likina.com uses.",
      html: `${LEGAL_DRAFT.en}<h2>Necessary</h2><p>The cart (<code>likina_cart</code>) and form protection — the site does not work without them. No consent needed.</p><h2>Analytics and advertising</h2><p>Google Analytics and Meta Pixel load only if you allow them in the cookie banner. You can change your choice at any time.</p>`,
    },
  },
};
