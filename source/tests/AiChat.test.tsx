import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiChat } from "../src/AiChat";

function json(payload: unknown) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
}

describe("AiChat", () => {
  const onCommit = vi.fn();
  const onRemember = vi.fn();
  beforeEach(() => {
    onCommit.mockReset();
    onRemember.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });
  afterEach(() => cleanup());
  const props = { date: "2026-11-08", meal: "午餐", today: "2026-11-08", setDate: () => {}, setMeal: () => {}, flash: () => {}, onCommit, onRemember };

  it("shows a no-key error and does not write the log", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat {...props} />);
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "米饭200克" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect((await screen.findByTestId("ai-error")).textContent).toMatch(/API Key/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keeps several foods pending until confirm, which commits once", async () => {
    localStorage.setItem("fl_ai", JSON.stringify({ key: "test-key", base: "https://example.test/v4", tm: "glm-4-flash", vm: "glm-4v-flash" }));
    vi.stubGlobal("fetch", vi.fn(async () => json({
      intent: "record", reply: "两样估算，还没写入记录", pending: [
        { name: "米饭", grams: 200, kcal: 232, protein: 5.2, carbs: 52, fat: 0.6, meal: "午餐" },
        { name: "鸡蛋", grams: 100, kcal: 144, protein: 13, carbs: 1.5, fat: 9, meal: "午餐" },
      ],
    })));
    render(<AiChat {...props} />);
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "午餐米饭200克和两个鸡蛋" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect(await screen.findByTestId("ai-pending")).toBeTruthy();
    expect(screen.getByText(/两样估算/)).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
    const btn = await screen.findByTestId("ai-confirm");
    act(() => { btn.click(); btn.click(); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    const [items, when] = onCommit.mock.calls[0];
    expect(when).toBe("2026-11-08");
    expect(items.map((x: { name: string; kcal: number }) => [x.name, x.kcal])).toEqual([["米饭", 232], ["鸡蛋", 144]]);
  });

  it("does not turn a nutrition question or a bad response into a food entry", async () => {
    localStorage.setItem("fl_ai", JSON.stringify({ key: "test-key", base: "https://example.test/v4", tm: "glm-4-flash", vm: "glm-4v-flash" }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ intent: "record", reply: "不算特别高", pending: [{ name: "鸡胸肉", grams: 100, kcal: 165, protein: 31, carbs: 0, fat: 4 }] }))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "你好" } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat {...props} />);
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "鸡胸肉热量高吗" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect(await screen.findByText(/不算特别高|不会把它记成食物/)).toBeTruthy();
    expect(screen.queryByTestId("ai-pending")).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "米饭200克" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect(await screen.findByTestId("ai-error")).toBeTruthy();
    expect(screen.getByTestId("ai-error").textContent).toMatch(/无法解析|没有改动/);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
