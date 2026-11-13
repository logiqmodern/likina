import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { amount, amountToCents, myposConfig, purchaseFields, readNotification, signParams, verifyParams, type MyposConfig } from "./mypos";

const ours = generateKeyPairSync("rsa", { modulusLength: 2048 });
const theirs = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = (k: KeyObject, type: "pkcs1" | "spki") => String(k.export({ type, format: "pem" } as never));

const cfg: MyposConfig = {
  sid: "000000000000010",
  walletNumber: "61938166610",
  privateKey: pem(ours.privateKey, "pkcs1"),
  myposCert: pem(theirs.publicKey, "spki"),
  keyIndex: "1",
  url: "https://www.mypos.com/vmp/checkout-test",
};

describe("myPOS signature (IPC v1.4)", () => {
  it("signs values joined with '-' → base64 → RSA-SHA256, verifiable with the public key", () => {
    const params: Array<[string, string]> = [
      ["IPCmethod", "IPCPurchase"],
      ["Amount", "450.00"],
    ];
    const sig = signParams(params, cfg.privateKey);
    expect(verifyParams(params, sig, pem(ours.publicKey, "spki"))).toBe(true);
    // order and content matter
    expect(verifyParams([params[1]!, params[0]!], sig, pem(ours.publicKey, "spki"))).toBe(false);
    expect(verifyParams([["IPCmethod", "IPCPurchase"], ["Amount", "1.00"]], sig, pem(ours.publicKey, "spki"))).toBe(false);
  });

  it("builds IPCPurchase with the signature last and the total as one line", () => {
    const f = purchaseFields(cfg, { number: "LK-2026-0001", totalCents: 45_050, email: "a@b.bg", lang: "bg" }, { ok: "https://x/ok", cancel: "https://x/c", notify: "https://x/n" });
    const map = Object.fromEntries(f);
    expect(f.at(-1)![0]).toBe("Signature");
    expect(map).toMatchObject({ Amount: "450.50", Amount_1: "450.50", Currency: "EUR", OrderID: "LK-2026-0001", IPCLanguage: "BG", SID: cfg.sid });
    expect(verifyParams(f.slice(0, -1), map.Signature!, pem(ours.publicKey, "spki"))).toBe(true);
  });

  it("accepts only notifications signed by myPOS", () => {
    const fields: Array<[string, string]> = [
      ["IPCmethod", "IPCPurchaseNotify"],
      ["SID", cfg.sid],
      ["Amount", "450.50"],
      ["Currency", "EUR"],
      ["OrderID", "LK-2026-0001"],
      ["IPC_Trnref", "12345678"],
    ];
    const body = new URLSearchParams([...fields, ["Signature", signParams(fields, pem(theirs.privateKey, "pkcs1"))]]);
    expect(readNotification(body, cfg)).toMatchObject({ method: "IPCPurchaseNotify", orderNumber: "LK-2026-0001", amountCents: 45_050, transactionRef: "12345678" });

    const forged = new URLSearchParams([...fields, ["Signature", signParams(fields, cfg.privateKey)]]);
    expect(readNotification(forged, cfg)).toBeNull();
    const tampered = new URLSearchParams(body);
    tampered.set("Amount", "1.00");
    expect(readNotification(tampered, cfg)).toBeNull();
  });

  it("amounts and configuration pack", () => {
    expect(amount(45_000)).toBe("450.00");
    expect(amountToCents("450.5")).toBe(45_050);
    expect(amountToCents("abc")).toBeNull();
    expect(myposConfig({})).toBeNull();
    const pack = Buffer.from(JSON.stringify({ sid: "1", cn: "2", pk: "k", pc: "c", idx: "1" })).toString("base64");
    expect(myposConfig({ MYPOS_CONFIG_PACK: pack, MYPOS_MODE: "production" })).toMatchObject({ sid: "1", walletNumber: "2", url: "https://www.mypos.com/vmp/checkout" });
    expect(myposConfig({ MYPOS_CONFIG_PACK: "not-a-pack" })).toBeNull();
  });
});
