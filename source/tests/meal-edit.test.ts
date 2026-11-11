import { describe, expect, it } from "vitest";
import { scaleEntryGrams, scaleEntryKcal, type Entry } from "../src/logic";

const rice: Entry = { id: 1, meal: "午餐", name: "米饭", grams: 100, k: 130, p: 2.6, c: 28, f: 0.3 };
const whey: Entry = { id: 2, meal: "加餐", name: "乳清蛋白 ×1", grams: 0, k: 150, p: 30, c: 4, f: 2, qty: 1 };

describe("logged meal edits", () => {
  it("scales grams and macros, and leaves a zero-gram entry unchanged", () => {
    expect(scaleEntryGrams(rice, 200)).toMatchObject({ grams: 200, k: 260, p: 5.2, c: 56, f: 0.6, meal: "午餐" });
    expect(scaleEntryGrams(whey, 50)).toEqual(whey);
  });
  it("scales a no-gram entry from its calories", () => {
    expect(scaleEntryKcal(whey, 300)).toMatchObject({ grams: 0, k: 300, p: 60, c: 8, f: 4, qty: 1 });
    expect(scaleEntryKcal(rice, 0)).toEqual(rice);
  });
});
