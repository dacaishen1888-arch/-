import { describe, expect, it } from "vitest";
import { calcTargets, carbWhy, fatLeftLabel, PROFILE_DEFAULT, r0, todayAnalysis, type Profile } from "../src/logic";

const train = calcTargets(PROFILE_DEFAULT, true);
const rest = calcTargets(PROFILE_DEFAULT, false);

describe("carb reassurance copy", () => {
  it("fills the calorie line from the current training or rest targets", () => {
    const day = carbWhy(train, true).join("\n");
    const sum = r0(train.p * 4 + train.c * 4 + train.f * 9);
    expect(day).toContain(`训练日 蛋白${train.p}g×4 + 碳水${train.c}g×4 + 脂肪${train.f}g×9 = ${sum} kcal`);
    expect(day).toContain(`低于消耗约 ${r0(train.tdee - train.kcal)} kcal`);
    expect(day).toContain("不会变成腹部脂肪");
    const off = carbWhy(rest, false).join("\n");
    expect(off).toContain(`休息日 蛋白${rest.p}g×4 + 碳水${rest.c}g×4 + 脂肪${rest.f}g×9`);
    expect(off).not.toContain(`碳水${train.c}g`);
  });

  it("follows an overridden target instead of the default 2115 formula", () => {
    const pr: Profile = { ...PROFILE_DEFAULT, tp: "150", tc: "180", tf: "40" };
    const tg = calcTargets(pr, true);
    expect(tg.p).toBe(150);
    expect(tg.c).toBe(180);
    expect(tg.f).toBe(40);
    const text = carbWhy(tg, true).join("\n");
    expect(text).toContain("蛋白150g×4 + 碳水180g×4 + 脂肪40g×9");
    expect(text).toContain(String(r0(150 * 4 + 180 * 4 + 40 * 9)));
    expect(text).not.toContain("蛋白165g");
  });
});

describe("next-meal hint when carbs and fat compete", () => {
  it("points to low-fat carbs when carbs are still short and fat is at least 80%", () => {
    const tot = { k: 1400, p: 90, c: train.c - 60, f: train.f * 0.85 };
    const a = todayAnalysis(tot, train, true, 12);
    expect(a.advice).toContain("少油");
    expect(a.advice).toMatch(/米饭|燕麦/);
    expect(a.advice).toContain(fatLeftLabel(tot.f, train.f).text);
    expect(a.advice).toContain("下一餐少油");
  });

  it("lets carbs continue from low-fat foods after fat is already over", () => {
    const met = { k: 1200, p: train.p, c: train.c, f: train.f + 6 };
    const a = todayAnalysis(met, train, true, 12);
    expect(a.advice).toContain("少油");
    expect(a.advice).toContain("碳水还可以吃");
    const still = { k: 1400, p: 80, c: train.c - 40, f: train.f + 4 };
    expect(todayAnalysis(still, train, true, 12).advice).toContain("碳水还可以吃");
    const over = { k: train.kcal + 40, p: 40, c: 40, f: train.f + 8 };
    expect(todayAnalysis(over, train, true, 12).advice).toContain("清淡");
    expect(todayAnalysis(over, train, true, 12).advice).not.toContain("还可以吃");
  });

  it("spends a tight calorie budget on protein, then carbs, and names the fat left", () => {
    const tot = { k: train.kcal - 80, p: train.p - 30, c: train.c - 40, f: 12 };
    const left = train.kcal - tot.k;
    const need = 30 * 4 + 40 * 4;
    expect(left).toBeLessThan(need);
    const a = todayAnalysis(tot, train, true, 12);
    expect(a.advice).toContain("先补蛋白");
    expect(a.advice).toContain("再补碳水");
    expect(a.advice).toContain("不加脂肪");
    expect(a.advice).toContain(`脂肪还剩 ${fatLeftLabel(12, train.f).left}g`);
  });
});

describe("fat budget label", () => {
  it("stays plain at 10g, turns orange under 10g, and red when over", () => {
    expect(fatLeftLabel(45, 55)).toEqual({ text: "脂肪还剩 10g", tone: "ok", left: 10 });
    expect(fatLeftLabel(46, 55).tone).toBe("low");
    expect(fatLeftLabel(46, 55).text).toBe("脂肪还剩 9g");
    expect(fatLeftLabel(60, 55)).toMatchObject({ text: "脂肪已超 5g", tone: "over" });
  });
});
