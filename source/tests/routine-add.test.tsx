import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";

describe("routine meal capsules add immediately", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.scrollTo = () => {};
    localStorage.setItem("fl_remind", "0");
    localStorage.setItem("fl_profile_v29", "1");
    localStorage.setItem("fl_profile_v35", "1");
    localStorage.setItem("fl_tpl", JSON.stringify({
      "训练餐": [{ id: 1, meal: "早餐", name: "米饭", grams: 100, k: 130, p: 2.6, c: 28, f: 0.3 }],
    }));
  });

  it("puts the routine into the tapped meal and updates the ring", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "+早餐" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+午餐" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /我的常规/ }));
    expect(screen.queryByRole("button", { name: "训练餐 减少" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "训练餐 数量" }));
    fireEvent.click(screen.getByRole("button", { name: "训练餐 2份" }));
    const group = screen.getByRole("group", { name: "训练餐 添加到" });
    fireEvent.click(within(group).getByRole("button", { name: "午餐" }));
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("✓ 已添加 训练餐 ×2 到 午餐");
    const card = document.querySelector('[data-meal="午餐"]');
    expect(card?.textContent).toContain("米饭");
    expect(card?.textContent).toContain("260");
    expect(document.querySelector('[data-meal="早餐"]')).toBeNull();
    expect(document.querySelector("svg[role=img]")?.getAttribute("aria-label")).toContain("热量 260/");
    fireEvent.click(within(toast).getByRole("button", { name: "撤销" }));
    expect(document.querySelector('[data-meal="午餐"]')).toBeNull();
    expect(document.querySelector("svg[role=img]")?.getAttribute("aria-label")).toContain("热量 0/");
  });

  it("keeps supplement quantity controls folded until tapped", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "乳清蛋白 减少" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "乳清蛋白 数量" }));
    expect(screen.getByRole("button", { name: "乳清蛋白 减少" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "乳清蛋白 数量" }));
    expect(screen.queryByRole("button", { name: "乳清蛋白 减少" })).toBeNull();
  });
});
