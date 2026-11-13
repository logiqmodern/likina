import { describe, expect, it } from "vitest";
import { cleanLegacyText, combineLegacyTexts, decodeEntities, removeCertificate, toLines } from "./legacy-text";

describe("toLines / decodeEntities", () => {
  it("turns HTML into lines with headings and paragraph breaks", () => {
    expect(toLines('<h3 class="x">Данни</h3><p data-a="1">Ред 1<br data-start="2" />Ред 2</p><ul><li>a</li></ul>')).toEqual([
      "\u0001Данни",
      "",
      "Ред 1",
      "Ред 2",
      "",
      "• a",
    ]);
    expect(decodeEntities("A&nbsp;&amp;&#8211;&#x41;")).toBe("A &–A");
  });
});

describe("cleanLegacyText", () => {
  const icon = `• Размер: 30.5 x 19.5 см
• 100% ръчно изрисувана икона
• Материали: дърво, левкас, 23 К злато, лак
• Зограф: Гергана НИКИФОРОВА

&nbsp;

Тази икона е изцяло ръчно изрисувана.`;

  it("extracts spec lines into fields and keeps the rest", () => {
    const c = cleanLegacyText(icon);
    expect(c.sizeLines).toEqual(["Размер: 30.5 x 19.5 см"]);
    expect(c.materials).toBe("дърво, левкас, 23 К злато, лак");
    expect(c.artistMentions).toEqual(["Гергана НИКИФОРОВА"]);
    expect(c.html).toBe("<ul><li>100% ръчно изрисувана икона</li></ul>\n<p>Тази икона е изцяло ръчно изрисувана.</p>");
  });

  it("drops the old trust bullets, shipping terms and contact block", () => {
    const c = cleanLegacyText(`✓ Оригинална авторска творба

✓ Сертификат за автентичност на творбата

✓ Безплатна доставка за Бълария /3-5 работни дни/

При нужда от повече информация, не се колебайте да ни пишете.

<h3>Детайли:</h3>
<p>Безплатна доставка за България – 3–5 работни дни.<br>Възможност за връщане или замяна в срок от 14 дни.</p>
<p>Тел.: +359 899 857 525<br>E-mail: x@y.z</p>`);
    expect(c.html).toBe("");
    expect(c.removedCertificate).toHaveLength(1);
  });

  it("reads a size whose numbers are on the next line, and frame yes/no", () => {
    const c = cleanLegacyText("<p><strong>Размер с рамката:</strong><br>112 × 131 см<br>Рамкирана и подписана: Да</p>");
    expect(c.sizeLines).toEqual(["Размер с рамката: 112 × 131 см"]);
    expect(c.framed).toBe(true);
  });

  it("removes every mention of the authenticity certificate (not issued, §4.3)", () => {
    expect(removeCertificate("Арт принт върху хартия + ръчна позлата + официален Сетификат")).toBe("Арт принт върху хартия + ръчна позлата");
    expect(removeCertificate("Творбата е оригинална. Предлага се със сертификат за автентичност. Рисувана е ръчно.")).toBe(
      "Творбата е оригинална. Рисувана е ръчно.",
    );
    expect(removeCertificate("Оригинална творба • Сертификат за автентичност • Налична")).toBe("Оригинална творба • Налична");
  });
});

describe("combineLegacyTexts", () => {
  it("keeps the longer text when both say the same, both when they differ", () => {
    const short = "Оригинална православна икона на Свети Николай, ръчно изписана от зограф Гергана Никифорова в техника яйчна темпера.";
    const long = `<p>${short} Иконата е изпълнена върху дървена основа с пигменти и позлата.</p><p>Св. Николай Мирликийски е християнски светец и епископ на град Мир в Ликия.</p>`;
    expect(combineLegacyTexts(short, long).textSource).toBe("content");
    const print = combineLegacyTexts("Размер на изображението: 16х21 см\n\nАвторски арт принт на Фуксия.", "<p>Принтовете са изработени по технология Giclée с архивни мастила.</p>");
    expect(print.textSource).toBe("both");
    expect(print.sizeLines).toEqual(["Размер на изображението: 16х21 см"]);
  });
});
