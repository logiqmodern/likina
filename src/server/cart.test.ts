import { describe, expect, it } from "vitest";
import { parseCart } from "./cart";

const id = "6f1c2c1e-1111-4a2b-9c3d-123456789abc";

describe("parseCart", () => {
  it("accepts valid lines and drops junk, duplicates and bad quantities", () => {
    expect(parseCart(JSON.stringify([{ id, qty: 1 }, { id, qty: 2 }, { id: "x", qty: 1 }, { id: id.replace("6f", "7f"), qty: 0 }]))).toEqual([{ id, qty: 1 }]);
  });
  it("survives broken cookies", () => {
    expect(parseCart("{oops")).toEqual([]);
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart('{"id":1}')).toEqual([]);
  });
});
