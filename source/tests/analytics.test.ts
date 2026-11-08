import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { addDays, analyzeWindow, calcTargets, dayDiff, entryFromFood, foodFromEntry, formatShanghai, isBaseFoodName, isTrain, lastNDays, movingAverage, r0, streakCount, sumEntries, type Entry, type Food, type Profile } from "../src/logic";

const profile: Profile = { h: "170", w: "82", age: "34", bf: "", act: "1.6", def: "18" };
const e = (id: number, k: number, p: number, c = 0, f = 0, grams = 100): Entry => ({ id, meal: "午餐", name: "食物", grams, k, p, c, f });

describe("Shanghai dates", () => {
  it("uses the Asia/Shanghai calendar day, including the 16:00 UTC boundary", () => {
    expect(formatShanghai(new Date("2026-11-08T15:59:59Z"))).toBe("2026-11-08");
    expect(formatShanghai(new Date("2026-11-08T16:00:00Z"))).toBe("2026-11-09");
  });
  it("shifts calendar dates without depending on the machine timezone", () => {
    expect(addDays("2026-11-08", -10)).toBe("2026-10-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayDiff("2026-11-01", "2026-11-08")).toBe(7);
    expect(lastNDays("2026-11-08", 7)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });
  it("treats Monday–Friday as training days from the calendar date", () => {
    expect(isTrain("2026-11-06")).toBe(true);
    expect(isTrain("2026-11-07")).toBe(false);
    expect(isTrain("2026-11-08")).toBe(false);
    expect(isTrain("2026-11-09")).toBe(true);
  });
});

describe("sums and the 7-day window", () => {
  it("sums stored entry totals", () => {
    expect(sumEntries([e(1, 1.2, 0.4, 1, 0.5), e(2, 2.3, 0.6, 2, 0.5)])).toEqual({ k: 3.5, p: 1, c: 3, f: 1 });
  });
  it("keeps a logged-day average separate from the 7-day average that counts blanks as zero", () => {
    const end = "2026-11-08";
    const log = { [addDays(end, -1)]: [e(1, 2100, 100)] };
    const w = analyzeWindow(log, end, profile);
    expect(w.days).toHaveLength(7);
    expect(w.days[6].date).toBe(end);
    expect(w.logged).toHaveLength(1);
    expect(w.avgKLogged).toBe(2100);
    expect(w.avgKAll).toBe(r0(2100 / 7));
    expect(w.avgPLogged).toBe(100);
    expect(w.avgPAll).toBe(r0(100 / 7));
  });
  it("counts a 0 kcal entry as logged, which the old kcal>0 filter did not", () => {
    const end = "2026-11-08";
    const w = analyzeWindow({ [end]: [e(1, 0, 0, 0, 0, 5)] }, end, profile);
    expect(w.logged).toHaveLength(1);
    expect(w.kcalPositive).toBe(0);
    expect(w.avgKLogged).toBe(0);
  });
  it("judges each day against that day's own calorie target", () => {
    const fri = "2026-11-06";
    const sat = "2026-11-07";
    const trainK = calcTargets(profile, true).kcal;
    const restK = calcTargets(profile, false).kcal;
    expect(trainK).toBeGreaterThan(restK);
    const w = analyzeWindow({
      [fri]: [e(1, trainK, 200)],
      [sat]: [e(2, restK, 200)],
    }, "2026-11-08", profile);
    expect(w.days.find((d) => d.date === fri)?.targetK).toBe(trainK);
    expect(w.days.find((d) => d.date === sat)?.targetK).toBe(restK);
    expect(w.kWithinLogged).toBe(2);
    expect(w.avgTargetKLogged).toBe(r0((trainK + restK) / 2));
    expect(w.pHitLogged).toBe(2);
    expect(w.pHitCalendar).toBe(2);
  });
  it("does not treat unlogged days as protein hits", () => {
    const end = "2026-11-08";
    const targetP = calcTargets(profile, true).p;
    const w = analyzeWindow({ [end]: [e(1, 500, targetP)] }, end, profile);
    expect(w.pHitLogged).toBe(1);
    expect(w.logged).toHaveLength(1);
    expect(w.pHitCalendar).toBe(1);
  });
  it("counts a streak up to today, or through yesterday when today is empty", () => {
    const today = "2026-11-08";
    const log = { [addDays(today, -1)]: [e(1, 1, 1)], [addDays(today, -2)]: [e(2, 1, 1)] };
    expect(streakCount(log, today)).toBe(2);
    expect(streakCount({ ...log, [today]: [e(3, 1, 1)] }, today)).toBe(3);
    expect(streakCount({ [addDays(today, -2)]: [e(2, 1, 1)] }, today)).toBe(0);
  });
  it("uses seven calendar points for the moving average", () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ date: addDays("2026-11-01", i), value: 80 }));
    const ma = movingAverage(points);
    expect(ma[9].value).toBe(80);
    const win = points.filter((p) => dayDiff(p.date, points[9].date) >= 0 && dayDiff(p.date, points[9].date) < 7);
    expect(win).toHaveLength(7);
  });
});

describe("per 100g and servings", () => {
  const rice: Food = { n: "米饭(熟)", k: 116, p: 2.6, c: 25.9, f: 0.3, g: 200, u: "一碗约200g" };
  const whey: Food = { n: "乳清蛋白(按勺)", k: 150, p: 30, c: 4, f: 2, g: 1, su: "勺", u: "1勺" };
  it("scales rice by grams/100 and scoops by count", () => {
    expect(entryFromFood(rice, 200, "午餐")).toMatchObject({ grams: 200, k: 232, name: "米饭(熟)" });
    expect(entryFromFood(rice, 50, "午餐").k).toBe(58);
    expect(entryFromFood(whey, 2, "加餐")).toMatchObject({ grams: 0, k: 300, name: "乳清蛋白(按勺) 2勺" });
  });
  it("does not turn a logged scoop back into a second library food", () => {
    const logged = entryFromFood(whey, 1, "加餐");
    expect(foodFromEntry({ ...logged, id: 1 }, (n) => isBaseFoodName(n, [whey.n, rice.n]))).toBeNull();
  });
  it("round-trips a custom gram entry through per-100g without doubling", () => {
    const logged: Entry = { id: 1, meal: "午餐", name: "食堂", grams: 200, k: 232, p: 5.2, c: 50, f: 2 };
    const saved = foodFromEntry(logged, () => false);
    expect(saved?.k).toBe(116);
    expect(entryFromFood(saved!, saved!.g, "午餐").k).toBe(232);
  });
});

describe("service worker", () => {
  it("bumps the cache to ct-v27", () => {
    expect(readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8")).toContain('const C = "ct-v27"');
  });
});
