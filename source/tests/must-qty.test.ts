import { describe, expect, it } from "vitest";
import { applyQty, calcTargets, entryFromSupplement, isMustReach, PROFILE_DEFAULT, todayAnalysis } from "../src/logic";

const tg = calcTargets(PROFILE_DEFAULT, true);
const rest = calcTargets(PROFILE_DEFAULT, false);

describe("must-reach highlights", () => {
  it("requires protein every day and carbs only on training days", () => {
    expect(isMustReach("蛋白", true)).toBe(true);
    expect(isMustReach("蛋白", false)).toBe(true);
    expect(isMustReach("碳水", true)).toBe(true);
    expect(isMustReach("碳水", false)).toBe(false);
    expect(isMustReach("热量", true)).toBe(false);
    expect(isMustReach("脂肪", false)).toBe(false);
    const train = todayAnalysis({ k: 500, p: 40, c: 80, f: 10 }, tg, true, 9);
    expect(train.lines.find((l) => l.name === "蛋白")).toMatchObject({ must: true, done: false, tone: "must" });
    expect(train.lines.find((l) => l.name === "蛋白")?.text).toContain("还差");
    expect(train.lines.find((l) => l.name === "碳水")?.must).toBe(true);
    expect(train.lines.find((l) => l.name === "热量")?.must).toBe(false);
    expect(train.lines.find((l) => l.name === "脂肪")?.tone).not.toBe("must");
    const restDay = todayAnalysis({ k: 500, p: 40, c: 20, f: 10 }, rest, false, 9);
    expect(restDay.lines.find((l) => l.name === "蛋白")?.must).toBe(true);
    expect(restDay.lines.find((l) => l.name === "碳水")).toMatchObject({ must: true, tone: "must" });
    expect(restDay.lines.find((l) => l.name === "碳水")?.text).toContain("到最低");
  });
  it("turns a reached must-hit macro green and only warns ceilings when they are over", () => {
    const done = todayAnalysis({ k: tg.kcal + 20, p: tg.p, c: tg.c + 5, f: tg.f + 3 }, tg, true, 12);
    expect(done.lines.find((l) => l.name === "蛋白")).toMatchObject({ done: true, tone: "done", text: "蛋白已吃够" });
    expect(done.lines.find((l) => l.name === "碳水")?.tone).toBe("done");
    expect(done.lines.find((l) => l.name === "热量")?.tone).toBe("over");
    expect(done.lines.find((l) => l.name === "脂肪")?.tone).toBe("over");
    expect(done.lines.find((l) => l.name === "热量")?.must).toBe(false);
  });
});

describe("quantity", () => {
  it("multiplies whey macros by scoops and still counts a zero-calorie supplement", () => {
    const whey = entryFromSupplement({ n: "乳清蛋白", k: 150, p: 30, c: 4, f: 2 }, 2);
    expect(whey).toMatchObject({ name: "乳清蛋白 ×2", k: 300, p: 60, c: 8, f: 4, qty: 2 });
    const creat = entryFromSupplement({ n: "肌酸 5g", k: 0, p: 0, c: 0, f: 0 }, 1);
    expect(creat).toMatchObject({ name: "肌酸 5g ×1", k: 0, p: 0, qty: 1 });
    const two = applyQty({ name: "米饭", grams: 200, k: 232, p: 5.2, c: 52, f: 0.6, qty: 1 }, 2);
    expect(two).toMatchObject({ name: "米饭 ×2", k: 464, grams: 400, qty: 2 });
    const three = applyQty(two, 3);
    expect(three.qty).toBe(3);
    expect(three.k).toBe(696);
    expect(three.name).toBe("米饭 ×3");
  });
});
