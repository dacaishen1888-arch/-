import { describe, expect, it } from "vitest";
import { entryFromFood, isSameFoodName, mergeSearchFoods, type Entry, type Food } from "../src/logic";

const whey: Food = { n: "乳清蛋白(按勺)", k: 150, p: 30, c: 4, f: 2, g: 1, su: "勺", u: "1勺" };
const rice: Food = { n: "米饭(熟)", k: 116, p: 2.6, c: 25.9, f: 0.3, g: 200, u: "一碗" };
const loggedWhey: Entry = { id: 1, meal: "加餐", name: "乳清蛋白(按勺) 1勺", grams: 0, k: 150, p: 30, c: 4, f: 2 };
const canteen = (k: number, grams = 400): Entry => ({ id: k, meal: "午餐", name: "公司食堂套餐", grams, k, p: 32, c: 80, f: 20 });

describe("search foods", () => {
  it("keeps scoop foods on serving math and custom history on per-100g math", () => {
    const foods = mergeSearchFoods([whey, rice], [], [loggedWhey, canteen(640)]);
    expect(foods.map((f) => f.n)).toEqual(["乳清蛋白(按勺)", "米饭(熟)", "公司食堂套餐"]);
    expect(entryFromFood(foods[0], 2, "加餐")).toMatchObject({ k: 300, grams: 0, name: "乳清蛋白(按勺) 2勺" });
    const custom = foods[2];
    expect(custom.k).toBe(160);
    expect(custom.su).toBeUndefined();
    expect(entryFromFood(custom, 400, "午餐").k).toBe(640);
    expect(entryFromFood(custom, 150, "午餐").k).toBe(240);
  });
  it("dedupes the same name and keeps 鸡蛋羹 distinct from 鸡蛋", () => {
    expect(isSameFoodName("乳清蛋白(按勺)", "乳清蛋白(按勺) 1勺")).toBe(true);
    expect(isSameFoodName("鸡蛋(整个)", "鸡蛋羹")).toBe(false);
    const mine: Food = { n: "公司食堂套餐", k: 100, p: 5, c: 10, f: 3, g: 400, u: "100g", mine: true };
    const foods = mergeSearchFoods([rice], [mine], [canteen(800), { id: 3, meal: "早餐", name: "鸡蛋羹", grams: 200, k: 120, p: 12, c: 4, f: 6 }]);
    expect(foods.map((f) => f.n)).toEqual(["公司食堂套餐", "米饭(熟)", "鸡蛋羹"]);
    expect(foods[0].k).toBe(100);
  });
  it("keeps the newest history nutrition when the food is not already in the library", () => {
    const foods = mergeSearchFoods([], [], [canteen(180, 100), canteen(100, 100)]);
    expect(foods).toHaveLength(1);
    expect(foods[0].k).toBe(180);
  });
});
