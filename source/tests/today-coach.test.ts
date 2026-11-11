import { describe, expect, it } from "vitest";
import { calcTargets, dueReminders, markReminderSeen, pickReminder, PROFILE_DEFAULT, seenReminders, shanghaiClock, todayAnalysis, type ReminderStore } from "../src/logic";

const tg = calcTargets(PROFILE_DEFAULT, true);
const rest = calcTargets(PROFILE_DEFAULT, false);
const zero = { k: 0, p: 0, c: 0, f: 0 };

function memory(): ReminderStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

describe("today analysis", () => {
  it("shows what is left against the training-day target and suggests carbs plus protein", () => {
    const tot = { k: 800, p: 40, c: tg.c - 80, f: tg.f * 0.9 };
    const a = todayAnalysis(tot, tg, true, 9);
    expect(a.lines.find((l) => l.name === "碳水")?.text).toBe("碳水还差 80g");
    expect(a.lines.find((l) => l.name === "脂肪")?.text).toMatch(/脂肪已到 90%/);
    expect(a.lines.find((l) => l.name === "热量")?.text).toContain("还可吃");
    expect(a.advice).toContain("少油");
    const hungry = todayAnalysis({ k: 800, p: 40, c: tg.c - 80, f: 20 }, tg, true, 9);
    expect(hungry.advice).toContain("补蛋白");
    expect(hungry.advice).toContain("补碳");
    expect(hungry.advice).not.toContain("别吃太少");
  });
  it("treats calories as a ceiling, and only warns about eating too little late on a training day", () => {
    const low = { k: tg.kcal - 500, p: tg.p, c: tg.c, f: 10 };
    expect(todayAnalysis(low, tg, true, 10).advice).not.toContain("别吃太少");
    expect(todayAnalysis(low, tg, true, 16).advice).toContain("别吃太少");
    expect(todayAnalysis(low, rest, false, 18).advice).not.toContain("别吃太少");
    const over = { k: tg.kcal + 30, p: tg.p, c: tg.c, f: 10 };
    expect(todayAnalysis(over, tg, true, 20).advice).toContain("清淡");
    const oily = { k: 1000, p: tg.p, c: tg.c, f: tg.f + 5 };
    expect(todayAnalysis(oily, tg, true, 12).advice).toContain("少油");
  });
});

describe("open reminders", () => {
  const base = { train: true, meals: [] as string[], breakfastCarbs: null as number | null, tot: zero, tg };
  it("reads Shanghai time", () => {
    expect(shanghaiClock(new Date("2026-11-11T01:00:00Z"))).toEqual({ h: 9, m: 0 });
    expect(shanghaiClock(new Date("2026-11-11T02:20:00Z"))).toEqual({ h: 10, m: 20 });
    expect(shanghaiClock(new Date("2026-11-11T11:05:00Z"))).toEqual({ h: 19, m: 5 });
  });
  it("picks the morning carb prompt, then skips it for the rest of the day", () => {
    const due = dueReminders({ ...base, h: 7, m: 30 });
    expect(due.map((r) => r.id)).toContain("pre-carb");
    expect(due.map((r) => r.id)).not.toContain("post-train");
    const store = memory();
    const first = pickReminder(due, seenReminders("2026-11-11", store));
    expect(first?.id).toBe("fat-over" in first! ? first!.id : "pre-carb");
    expect(first?.text).toContain("碳水");
    markReminderSeen("2026-11-11", first!.id, store);
    expect(pickReminder(due, seenReminders("2026-11-11", store))?.id).not.toBe(first!.id);
  });
  it("asks for a post-workout meal after 10:20 and protein after 19:00", () => {
    const post = dueReminders({ ...base, h: 10, m: 20, meals: ["早餐"], breakfastCarbs: 50 });
    expect(post.map((r) => r.id)).toEqual(["post-train"]);
    expect(dueReminders({ ...base, h: 10, m: 20, meals: ["早餐", "训练后"], breakfastCarbs: 50 })).toEqual([]);
    const night = dueReminders({ ...base, h: 19, m: 0, train: false, meals: ["晚餐"], breakfastCarbs: 0, tot: { k: 1500, p: rest.p - 40, c: rest.c, f: 10 }, tg: rest });
    expect(night.map((r) => r.id)).toContain("evening-protein");
    const oily = dueReminders({ ...base, h: 15, m: 0, meals: ["午餐"], breakfastCarbs: 50, tot: { k: 1000, p: tg.p, c: tg.c, f: tg.f + 1 } });
    expect(oily[0]?.id).toBe("fat-over");
    expect(oily[0]?.text).toContain("控油");
  });
  it("does not repeat a stored reminder id", () => {
    const due = dueReminders({ ...base, h: 8, m: 0 });
    expect(pickReminder(due, ["pre-carb"])?.id).not.toBe("pre-carb");
  });
});
