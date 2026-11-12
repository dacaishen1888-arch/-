import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";
import { addDays, mondayOf, shanghaiToday } from "../src/logic";

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
    expect(days.map((b) => b.textContent)).toEqual(["周一", "周二", "周三", "周四", "周五", "周六", "周日"]);
    const mon = mondayOf(shanghaiToday());
    expect(days[0].getAttribute("data-date")).toBe(mon);
    expect(days[6].getAttribute("data-date")).toBe(addDays(mon, 6));
    expect((screen.getByRole("button", { name: "下一周" }) as HTMLButtonElement).disabled).toBe(true);
    if (addDays(mon, 6) > shanghaiToday()) expect(panel.textContent).toContain("截至今天");
    fireEvent.click(screen.getByRole("button", { name: "上一周" }));
    expect((screen.getByRole("button", { name: "下一周" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByRole("button", { name: /查看 / })[0].getAttribute("data-date")).toBe(addDays(mon, -7));
    fireEvent.click(screen.getByRole("button", { name: "下一周" }));
    expect((screen.getByRole("button", { name: "下一周" }) as HTMLButtonElement).disabled).toBe(true);
    const back = screen.getAllByRole("button", { name: /查看 / });
    const iso = back[6].getAttribute("data-date");
    fireEvent.click(back[6]);
    expect(screen.getByTestId("day-view")).toBeTruthy();
    expect(screen.queryByTestId("week-panel")).toBeNull();
    expect((screen.getByLabelText("日期") as HTMLInputElement).value).toBe(iso);
  });
});
