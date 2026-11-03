import { describe, expect, it } from "vitest";
import { INQUIRY_MAX_LENGTH } from "@/lib/inquiry-fields";
import { validateInquiry } from "./inquiries";

const customIcon = {
  name: "Мария Иванова",
  email: "maria@example.com",
  phone: "0887 123 456",
  subject: "Св. Николай Чудотворец",
  size: "20 × 30 см",
  deadline: "до Коледа",
  message: "За подарък.",
};

function formData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("validateInquiry", () => {
  it("accepts a valid custom icon inquiry and normalizes the phone", () => {
    const r = validateInquiry("custom_icon", customIcon);
    expect(r).toEqual({ ok: true, spam: false, data: { ...customIcon, phone: "+359887123456" } });
  });

  it("reads FormData and trims values", () => {
    const r = validateInquiry("contact", formData({ name: "  Ани ", email: " ani@example.com ", message: " Здравейте " }));
    expect(r).toEqual({ ok: true, spam: false, data: { name: "Ани", email: "ani@example.com", message: "Здравейте" } });
  });

  it("drops empty optional fields and ignores fields the type does not accept", () => {
    const r = validateInquiry("custom_icon", { ...customIcon, phone: "", size: " ", artwork: "x", extra: "y" });
    expect(r.ok && !r.spam && r.data).toEqual({
      name: customIcon.name,
      email: customIcon.email,
      subject: customIcon.subject,
      deadline: customIcon.deadline,
      message: customIcon.message,
    });
  });

  it("requires a name and keeps the entered values", () => {
    const r = validateInquiry("custom_icon", { ...customIcon, name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual({ name: "Въведете име" });
      expect(r.values.email).toBe(customIcon.email);
    }
  });

  it("reports every missing required field", () => {
    const r = validateInquiry("custom_icon", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "name", "subject"]);
  });

  it.each(["123", "0887 12", "abc 887 374 755", "+1 2"])("rejects an invalid phone %j", (phone) => {
    const r = validateInquiry("contact", { name: "Ани", email: "ani@example.com", phone, message: "x" });
    expect(!r.ok && r.errors.phone).toBe("Въведете валиден телефонен номер");
  });

  it.each(["maria", "maria@", "maria@example", "a b@example.com"])("rejects an invalid e-mail %j", (email) => {
    const r = validateInquiry("custom_icon", { ...customIcon, email });
    expect(!r.ok && r.errors.email).toBe("Въведете валиден имейл адрес");
  });

  it("requires a message for the contact form and an artwork for „поръчай подобна“", () => {
    const contact = validateInquiry("contact", { name: "Ани", email: "ani@example.com", message: "" });
    expect(!contact.ok && contact.errors.message).toBe("Напишете съобщение");
    const similar = validateInquiry("similar_artwork", { name: "Ани", email: "ani@example.com" });
    expect(!similar.ok && similar.errors.artwork).toBe("Изберете творба");
  });

  it("treats a filled honeypot as spam without validating", () => {
    expect(validateInquiry("custom_icon", { website: "http://spam.example" })).toEqual({ ok: true, spam: true });
    expect(validateInquiry("contact", formData({ ...customIcon, website: "x" }))).toEqual({ ok: true, spam: true });
  });

  it("enforces max lengths", () => {
    const over = validateInquiry("custom_icon", {
      ...customIcon,
      name: "а".repeat(INQUIRY_MAX_LENGTH.name + 1),
      message: "б".repeat(INQUIRY_MAX_LENGTH.message + 1),
    });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.errors).toEqual({
        name: `Най-много ${INQUIRY_MAX_LENGTH.name} знака`,
        message: `Най-много ${INQUIRY_MAX_LENGTH.message} знака`,
      });
    }
  });
});
