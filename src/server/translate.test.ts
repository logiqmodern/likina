import { describe, expect, it } from "vitest";
import { parseTranslation, translateFields, type FetchLike } from "./translate";

describe("translateFields (Claude API mocked)", () => {
  it("sends only non-empty fields and returns the translations", async () => {
    let sent: { system: string; messages: Array<{ content: string }> } | null = null;
    const fetchMock: FetchLike = async (_url, init) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: '```json\n{"title":"St Nicholas","description":"<p>Hand-painted.</p>"}\n```' }] }));
    };
    const out = await translateFields({ title: "Св. Николай", description: "<p>Ръчно рисувана.</p>", story: null, technique: " " }, "bg>en", { apiKey: "k", fetch: fetchMock });
    expect(out).toEqual({ title: "St Nicholas", description: "<p>Hand-painted.</p>" });
    expect(JSON.parse(sent!.messages[0]!.content)).toEqual({ title: "Св. Николай", description: "<p>Ръчно рисувана.</p>" });
    expect(sent!.system).toContain("Never translate personal names");
  });

  it("returns null on an API error or a reply without every key", async () => {
    const fail: FetchLike = async () => new Response("overloaded", { status: 529 });
    expect(await translateFields({ a: "x" }, "bg>en", { apiKey: "k", fetch: fail })).toBeNull();
    expect(parseTranslation('{"a":"x"}', ["a", "b"])).toBeNull();
    expect(parseTranslation("not json", ["a"])).toBeNull();
  });

  it("does not call the API for nothing", async () => {
    const never: FetchLike = async () => {
      throw new Error("called");
    };
    expect(await translateFields({ a: "", b: null }, "bg>en", { apiKey: "k", fetch: never })).toEqual({});
  });
});
