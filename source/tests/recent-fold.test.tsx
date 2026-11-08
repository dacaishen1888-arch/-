import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";

describe("最近添加", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.scrollTo = () => {};
    localStorage.setItem("fl_myfoods", JSON.stringify([
      { n: "回填酸奶", k: 70, p: 10, c: 4, f: 2, g: 150, u: "100g", mine: true },
      { n: "回填鸡胸", k: 165, p: 31, c: 0, f: 4, g: 150, u: "100g", mine: true },
    ]));
    localStorage.setItem("fl_log", JSON.stringify({
      "2026-11-01": [
        { id: 1, meal: "午餐", name: "公司食堂套餐", grams: 400, k: 640, p: 32, c: 80, f: 20 },
        { id: 2, meal: "加餐", name: "乳清蛋白(按勺) 1勺", grams: 0, k: 150, p: 30, c: 4, f: 2 },
      ],
    }));
  });

  it("starts collapsed and still finds history, library foods, and the scoop serving", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "添加食物" }));
    const mine = screen.getByTestId("mine-toggle");
    const recent = screen.getByTestId("recent-toggle");
    expect(mine.getAttribute("aria-expanded")).toBe("false");
    expect(recent.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("mine-list")).toBeNull();
    expect(screen.queryByTestId("recent-list")).toBeNull();
    expect(screen.queryByText(/回填酸奶/)).toBeNull();
    fireEvent.click(recent);
    expect(screen.getByTestId("recent-list").textContent).toContain("公司食堂套餐");
    fireEvent.click(recent);
    expect(screen.queryByTestId("recent-list")).toBeNull();
    fireEvent.click(mine);
    expect(screen.getByTestId("mine-list").textContent).toContain("回填酸奶");
    fireEvent.click(mine);
    const input = screen.getByPlaceholderText("如：鸡胸、米饭、黄焖鸡");
    fireEvent.change(input, { target: { value: "公司食堂套餐" } });
    expect(screen.getByText(/每100g 160kcal/)).toBeTruthy();
    fireEvent.change(input, { target: { value: "乳清蛋白(按勺) 1勺" } });
    expect(screen.getAllByText(/乳清蛋白\(按勺\)/)).toHaveLength(1);
    expect(screen.getByText(/每勺 150kcal/)).toBeTruthy();
    fireEvent.change(input, { target: { value: "回填酸奶" } });
    expect(screen.getByText(/每100g 70kcal/)).toBeTruthy();
  });
});
