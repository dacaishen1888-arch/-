import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { shanghaiToday } from "../src/logic";

const wheyOld = { n: "乳清蛋白", dose: "1勺", k: 150, p: 30, c: 4, f: 2 };
const wheyCustom = { n: "乳清蛋白", dose: "自配", k: 140, p: 28, c: 3, f: 1 };

describe("v46 whey defaults and my foods", () => {
  let realSet: typeof window.setTimeout;
  let realClear: typeof window.clearTimeout;
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.setTimeout = realSet;
    window.clearTimeout = realClear;
  });
  beforeEach(() => {
    realSet = window.setTimeout;
    realClear = window.clearTimeout;
    localStorage.clear();
    sessionStorage.clear();
    window.scrollTo = () => {};
    localStorage.setItem("fl_remind", "0");
    localStorage.setItem("fl_profile_v29", "1");
    localStorage.setItem("fl_profile_v35", "1");
  });

  it("migrates an untouched whey supplement once and keeps logged meals", () => {
    const today = shanghaiToday();
    const logged = { id: 9, meal: "加餐", name: "乳清蛋白 ×1", grams: 0, k: 150, p: 30, c: 4, f: 2, qty: 1 };
    localStorage.setItem("fl_supp_list", JSON.stringify([wheyOld, { n: "肌酸 5g", dose: "", k: 0, p: 0, c: 0, f: 0 }]));
    localStorage.setItem("fl_log", JSON.stringify({ [today]: [logged] }));
    render(<App />);
    const list = JSON.parse(localStorage.getItem("fl_supp_list") || "[]");
    expect(list[0]).toMatchObject({ n: "乳清蛋白", dose: "1勺=30g粉", k: 118, p: 23.7, c: 1.7, f: 1.7 });
    expect(list[1].n).toBe("肌酸 5g");
    expect(JSON.parse(localStorage.getItem("fl_log") || "{}")[today][0]).toMatchObject(logged);
    cleanup();
    localStorage.setItem("fl_supp_list", JSON.stringify([wheyOld]));
    render(<App />);
    expect(JSON.parse(localStorage.getItem("fl_supp_list") || "[]")[0].k).toBe(150);
  });

  it("leaves a supplement the user already edited", () => {
    localStorage.setItem("fl_supp_list", JSON.stringify([wheyCustom]));
    render(<App />);
    expect(JSON.parse(localStorage.getItem("fl_supp_list") || "[]")[0]).toMatchObject(wheyCustom);
  });

  it("says a scoop is 30g of powder", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByText(/1勺=30g粉，118kcal、蛋白23.7g、碳水1.7g、脂肪1.7g/)).toBeTruthy();
    expect(screen.queryByText(/约40g粉/)).toBeNull();
    expect(screen.queryByText(/约38g/)).toBeNull();
    expect(screen.queryByText(/为常见产品估算/)).toBeNull();
    expect(screen.queryByText(/1勺=30g蛋白/)).toBeNull();
  });

  it("deletes one saved food, offers undo, and does not touch history", () => {
    const today = shanghaiToday();
    const logged = { id: 3, meal: "午餐", name: "回填酸奶", grams: 150, k: 105, p: 15, c: 6, f: 3 };
    localStorage.setItem("fl_myfoods", JSON.stringify([
      { n: "回填酸奶", k: 70, p: 10, c: 4, f: 2, g: 150, u: "100g", mine: true },
      { n: "回填鸡胸", k: 165, p: 31, c: 0, f: 4, g: 150, u: "100g", mine: true },
    ]));
    localStorage.setItem("fl_log", JSON.stringify({ [today]: [logged] }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "添加食物" }));
    fireEvent.click(screen.getByTestId("mine-toggle"));
    const list = screen.getByTestId("mine-list");
    expect(list.textContent).toContain("回填酸奶");
    fireEvent.click(screen.getByRole("button", { name: "删除 回填酸奶" }));
    expect(screen.getByTestId("mine-list").textContent).not.toContain("回填酸奶");
    expect(screen.getByTestId("mine-list").textContent).toContain("回填鸡胸");
    const toast = screen.getByTestId("mine-undo");
    expect(toast.textContent).toContain("已删除 回填酸奶");
    expect(JSON.parse(localStorage.getItem("fl_log") || "{}")[today][0]).toMatchObject(logged);
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByTestId("mine-list").textContent).toContain("回填酸奶");
    expect(JSON.parse(localStorage.getItem("fl_myfoods") || "[]").map((f: { n: string }) => f.n)).toEqual(["回填酸奶", "回填鸡胸"]);
    fireEvent.click(screen.getByRole("button", { name: "返回今日" }));
    expect(document.querySelector('[data-meal="午餐"]')?.textContent).toContain("回填酸奶");
    expect(JSON.parse(localStorage.getItem("fl_log") || "{}")[today][0]).toMatchObject(logged);
  });

  it("drops the food undo after about five seconds", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    window.setTimeout = setTimeout as typeof window.setTimeout;
    window.clearTimeout = clearTimeout as typeof window.clearTimeout;
    localStorage.setItem("fl_myfoods", JSON.stringify([
      { n: "回填酸奶", k: 70, p: 10, c: 4, f: 2, g: 150, u: "100g", mine: true },
    ]));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "添加食物" }));
    fireEvent.click(screen.getByTestId("mine-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "删除 回填酸奶" }));
    expect(screen.getByTestId("mine-undo").textContent).toContain("已删除 回填酸奶");
    act(() => { vi.advanceTimersByTime(4999); });
    expect(screen.getByTestId("mine-undo")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByTestId("mine-undo")).toBeNull();
    expect(screen.queryByTestId("mine-list")).toBeNull();
    expect(JSON.parse(localStorage.getItem("fl_myfoods") || "[]")).toEqual([]);
  });
});
