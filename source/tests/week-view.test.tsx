import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";

describe("simple week view", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("fl_remind", "0");
    localStorage.setItem("fl_profile_v29", "1");
    localStorage.setItem("fl_profile_v35", "1");
  });

  it("keeps the week summary out of the daily view", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "📈 数据分析" }));
    expect(screen.getByTestId("day-view")).toBeTruthy();
    expect(screen.queryByTestId("week-panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "一周" }));
    expect(screen.queryByTestId("day-view")).toBeNull();
    const panel = screen.getByTestId("week-panel");
    expect(panel.textContent).toContain("未记录");
    expect(panel.querySelector(".ct-mrow")).toBeNull();
    expect(panel.querySelector(".ct-sqs")).toBeNull();
    const ring = screen.getByRole("img", { name: /未记录/ });
    expect(ring.getAttribute("aria-label")).toContain("碳水");
    const days = screen.getAllByRole("button", { name: /查看 / });
    expect(days).toHaveLength(7);
    const iso = days[6].getAttribute("data-date");
    fireEvent.click(days[6]);
    expect(screen.getByTestId("day-view")).toBeTruthy();
    expect(screen.queryByTestId("week-panel")).toBeNull();
    expect((screen.getByLabelText("日期") as HTMLInputElement).value).toBe(iso);
  });
});
