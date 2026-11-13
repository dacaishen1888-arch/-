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

describe("milk nutrition and stated grams", () => {
  const per100 = { 能量: "266kJ", 蛋白质: "3.0g", 脂肪: "3.8g", 碳水化合物: "4.4g" };
  it("converts kJ per 100g and scales 200g to about 127 kcal", () => {
    const turn = resolveTurn([], "牛奶巴氏200克", JSON.stringify({
      intent: "record",
      reply: "每100g 能量 266 kJ、蛋白 3.0g、脂肪 3.8g、碳水 4.4g",
      pending: [{ name: "牛奶巴氏", grams: 200, 每100g: per100 }],
    }), "2026-11-12");
    const milk = turn.pending[0];
    expect(Math.round(milk.kcal)).toBe(127);
    expect(milk.protein).toBeCloseTo(6, 5);
    expect(milk.carbs).toBeCloseTo(8.8, 5);
    expect(milk.fat).toBeCloseTo(7.6, 5);
    expect(milk.missing).toBeFalsy();
  });
  it("estimates kcal from macros and reads nutrition out of the reply when the fields are zero", () => {
    const estimated = resolveTurn([], "鸡胸100克", JSON.stringify({
      intent: "record", reply: "估算", pending: [{ name: "鸡胸", grams: 100, kcal: 0, protein: "30g", carbs: "0", fat: "5g" }],
    }), "2026-11-12");
    expect(estimated.pending[0].kcal).toBeCloseTo(165, 5);
    expect(estimated.pending[0].missing).toBeFalsy();
    const fromReply = resolveTurn([], "牛奶巴氏200", JSON.stringify({
      intent: "record",
      reply: "牛奶巴氏每100g：能量266kJ，蛋白3.0g，脂肪3.8g，碳水4.4g",
      pending: [{ name: "牛奶巴氏", grams: 200, kcal: 0, protein: 0, carbs: 0, fat: 0 }],
    }), "2026-11-12");
    expect(Math.round(fromReply.pending[0].kcal)).toBe(127);
    expect(fromReply.pending[0].protein).toBeCloseTo(6, 5);
    const blank = resolveTurn([], "神秘酱", JSON.stringify({
      intent: "record", reply: "没有查到营养", pending: [{ name: "神秘酱", grams: 30, kcal: 0, protein: 0, carbs: 0, fat: 0 }],
    }), "2026-11-12");
    expect(blank.pending[0].missing).toBe(true);
    expect(entriesFromPending(blank.pending, "午餐")).toEqual([]);
  });
  it("uses a gram amount the user already gave and does not ask again", () => {
    const prev = [withBase({ id: "milk", name: "牛奶巴氏", grams: 100, kcal: 266 / 4.184, protein: 3, carbs: 4.4, fat: 3.8, source: "ai" })];
    const ask = JSON.stringify({ intent: "chat", reply: "请输入牛奶巴氏的克数", pending: null });
    for (const text of ["200", "200g", "200克", "200ml"]) {
      const turn = resolveTurn(prev, text, ask, "2026-11-12");
      expect(turn.pending[0].grams).toBe(200);
      expect(Math.round(turn.pending[0].kcal)).toBe(127);
      expect(turn.reply).not.toContain("请输入");
    }
    const same = resolveTurn([], "牛奶巴氏200ml", JSON.stringify({
      intent: "record", reply: "请输入牛奶巴氏的克数", pending: [{ name: "牛奶巴氏", grams: 100, 每100g: per100 }],
    }), "2026-11-12");
    expect(same.pending).toHaveLength(1);
    expect(same.pending[0].grams).toBe(200);
    expect(Math.round(same.pending[0].kcal)).toBe(127);
    expect(same.reply).not.toContain("请输入");
    expect(buildChatMessages([], [], "200ml").find((m) => m.role === "system")?.content).toContain("不要再追问");
    expect(buildChatMessages([], [], "200ml").find((m) => m.role === "system")?.content).toContain("4.184");
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
