import { describe, expect, it, vi } from "vitest";
import { buildChatMessages, callAiRaw, chatRequestBody, entriesFromPending, looksLikeApiKey, resolveTurn, scalePending, withBase, type PendingFood } from "../src/aiChat";

const rice = (grams = 200, kcal = 232): PendingFood => withBase({ id: "rice", name: "米饭", grams, kcal, protein: 5.2, carbs: 52, fat: 0.6, meal: "午餐", source: "ai" });
const egg = (): PendingFood => withBase({ id: "egg", name: "鸡蛋", grams: 100, kcal: 144, protein: 13, carbs: 1.5, fat: 9, meal: "午餐", source: "ai" });

describe("chat turns do not write food by themselves", () => {
  it("asks the model for a full pending list and does not include a key or a food log", () => {
    const msgs = buildChatMessages([rice()], [{ role: "user", content: "早餐吃了什么" }, { role: "assistant", content: "还没写入记录" }], "米饭改成150克");
    const blob = JSON.stringify(msgs);
    expect(blob).toContain("米饭改成150克");
    expect(blob).toContain("还没写入饮食记录");
    expect(blob).not.toContain("test-key");
    expect(blob).not.toContain("fl_log");
    expect(msgs.filter((m) => m.role !== "system")).toHaveLength(3);
    const long = Array.from({ length: 8 }, (_, i) => ({ role: "user" as const, content: `h${i}` }));
    expect(buildChatMessages([], long, "再加鸡蛋").filter((m) => m.role === "user")).toHaveLength(7);
    expect(Object.keys(chatRequestBody("glm-4-flash", msgs)).sort()).toEqual(["messages", "model", "temperature"]);
  });
  it("turns a nutrition question into chat even if the model returns foods", () => {
    const prev = [rice()];
    const raw = JSON.stringify({ intent: "record", reply: "鸡胸不算特别高", pending: [{ name: "鸡胸肉", grams: 100, kcal: 165, protein: 31, carbs: 0, fat: 4 }] });
    const turn = resolveTurn(prev, "鸡胸肉热量高吗", raw, "2026-11-08");
    expect(turn.intent).toBe("chat");
    expect(turn.pending).toEqual(prev);
    expect(turn.date).toBeNull();
  });
  it("records several foods, revises grams without a duplicate, and adds an egg", () => {
    const first = resolveTurn([], "午餐吃了米饭200克和两个鸡蛋", JSON.stringify({
      intent: "record", reply: "两样，估算，还没写入", pending: [
        { name: "米饭", grams: 200, kcal: 232, protein: 5.2, carbs: 52, fat: 0.6, meal: "午餐" },
        { name: "鸡蛋", grams: 50, kcal: 72, protein: 6.5, carbs: 0.8, fat: 4.5 },
        { name: "鸡蛋", grams: 50, kcal: 72, protein: 6.5, carbs: 0.7, fat: 4.5 },
      ],
    }), "2026-11-08");
    expect(first.pending.map((p) => p.name)).toEqual(["米饭", "鸡蛋"]);
    expect(first.pending[1].grams).toBe(100);
    expect(first.pending[1].kcal).toBe(144);
    const revised = resolveTurn(first.pending, "米饭改成150克", JSON.stringify({
      intent: "revise", reply: "米饭改为150克", pending: [{ name: "米饭", grams: 150, kcal: 232, protein: 5.2, carbs: 52, fat: 0.6 }],
    }), "2026-11-08");
    expect(revised.pending.map((p) => p.name)).toEqual(["米饭", "鸡蛋"]);
    expect(revised.pending[0].grams).toBe(150);
    expect(revised.pending[0].kcal).toBeCloseTo(174, 5);
    const added = resolveTurn([rice()], "再加两个鸡蛋", JSON.stringify({
      intent: "revise", reply: "加上鸡蛋", pending: [egg()],
    }), "2026-11-08");
    expect(added.pending.map((p) => p.name)).toEqual(["鸡蛋", "米饭"]);
  });
  it("leaves the draft alone when the model response is garbage", () => {
    const prev = [rice()];
    const turn = resolveTurn(prev, "米饭200克", "not json", "2026-11-08");
    expect(turn.error).toContain("无法解析");
    expect(turn.pending).toBe(prev);
  });
  it("commits the portion totals once, not a second per-100g conversion", () => {
    const items = [rice(), egg()];
    const rows = entriesFromPending(items, "早餐");
    expect(rows.map((r) => r.k)).toEqual([232, 144]);
    expect(rows[0].grams).toBe(200);
    expect(scalePending(rice(), 100).kcal).toBeCloseTo(116, 5);
  });
  it("refuses to treat a pasted key as a meal", () => {
    expect(looksLikeApiKey("sk-test-1234567890abcdef")).toBe(true);
    expect(looksLikeApiKey("米饭200克")).toBe(false);
  });
});

describe("callAiRaw", () => {
  it("sends the key only as a bearer header and reports a missing key without calling the network", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(JSON.stringify(body)).not.toContain("test-key");
      expect(Object.keys(body).sort()).toEqual(["messages", "model", "temperature"]);
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{\"intent\":\"chat\",\"reply\":\"ok\",\"pending\":null}" } }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    await callAiRaw({ key: "test-key", base: "https://example.test/v4/", tm: "glm-4-flash", vm: "glm-4v-flash" }, [{ role: "user", content: "米饭" }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://example.test/v4/chat/completions");
    await expect(callAiRaw({ key: "", base: "https://example.test/v4", tm: "glm-4-flash", vm: "glm-4v-flash" }, [])).rejects.toThrow(/API Key/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
