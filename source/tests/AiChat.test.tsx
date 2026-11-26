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

  it("logs common foods from the built-in table when no key is set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat {...props} />);
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "米饭200克" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect((await screen.findByTestId("pend-米饭(熟)")).textContent).toContain("这份 232 kcal");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ai-confirm"));
    expect(onCommit).toHaveBeenCalledTimes(1);
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

  it("shows scaled milk nutrition and will not confirm an unrecognized item", async () => {
    localStorage.setItem("fl_ai", JSON.stringify({ key: "test-key", base: "https://example.test/v4", tm: "glm-4-flash", vm: "glm-4v-flash" }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        intent: "record",
        reply: "每100g 能量 266 kJ、蛋白 3.0g、脂肪 3.8g、碳水 4.4g",
        pending: [{ name: "牛奶巴氏", grams: 200, 每100g: { 能量: "266kJ", 蛋白质: "3.0g", 脂肪: "3.8g", 碳水化合物: "4.4g" } }],
      }))
      .mockResolvedValueOnce(json({ intent: "record", reply: "没有查到营养", pending: [{ name: "神秘酱", grams: 30, kcal: 0, protein: 0, carbs: 0, fat: 0 }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat {...props} />);
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "牛奶巴氏200克" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect((await screen.findByTestId("pend-牛奶巴氏")).textContent).toContain("这份 127 kcal");
    expect(screen.getByTestId("pend-牛奶巴氏").textContent).toContain("蛋白 6.0");
    expect(screen.getByTestId("pend-牛奶巴氏").textContent).toContain("碳水 8.8");
    expect(screen.getByTestId("pend-牛奶巴氏").textContent).toContain("脂肪 7.6");
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "神秘酱" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    expect((await screen.findByTestId("pend-神秘酱")).textContent).toContain("营养未识别，请补充");
    fireEvent.click(screen.getByTestId("ai-confirm"));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("ai-error").textContent).toContain("营养未识别，请补充");
    expect(screen.getByTestId("pend-神秘酱")).toBeTruthy();
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
    expect((await screen.findByTestId("pend-米饭(熟)")).textContent).toContain("232 kcal");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("stacks portion shortcuts into one confirm", () => {
    render(<AiChat {...props} />);
    fireEvent.click(screen.getByTestId("sc-bowl-rice"));
    fireEvent.click(screen.getByTestId("sc-palm-meat"));
    fireEvent.click(screen.getByTestId("sc-scoop-whey"));
    const pending = screen.getByTestId("ai-pending").textContent || "";
    expect(pending).toContain("米饭(熟)");
    expect(pending).toContain("232 kcal");
    expect(pending).toContain("猪里脊(熟)");
    expect(pending).toContain("118 kcal");
    expect(onCommit).not.toHaveBeenCalled();
    const btn = screen.getByTestId("ai-confirm");
    act(() => { btn.click(); btn.click(); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    const items = onCommit.mock.calls[0][0] as { name: string; grams: number; kcal: number; protein: number }[];
    expect(items.map((x) => [x.name, x.grams, Math.round(x.kcal)])).toEqual([
      ["米饭(熟)", 200, 232],
      ["猪里脊(熟)", 100, 155],
      ["乳清蛋白", 30, 118],
    ]);
    expect(items[2].protein).toBeCloseTo(23.7, 5);
  });

  it("reads a pasted nutrition label and a known barcode without writing zeros", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat {...props} />);
    fireEvent.change(screen.getByTestId("ai-txt"), { target: { value: "营养成分表\n项目 每100克含量\n能量 1649千焦\n蛋白质 79.0克\n脂肪 5.6克\n碳水化合物 5.8克\n钠 470毫克" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    const whey = await screen.findByTestId("pend-蛋白粉");
    expect(whey.textContent).toContain("394 kcal");
    expect(whey.textContent).toContain("蛋白 79.0");
    expect(whey.textContent).not.toContain("营养未识别");
    fireEvent.change(screen.getByTestId("barcode-code"), { target: { value: "6959909102831" } });
    fireEvent.click(screen.getByTestId("barcode-lookup"));
    expect((await screen.findAllByText(/九牛巴氏鲜奶/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/每100g 64 kcal/).length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("barcode-pending"));
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("barcode-code"), { target: { value: "12345670" } });
    fireEvent.click(screen.getByTestId("barcode-lookup"));
    expect((await screen.findByTestId("ai-error")).textContent).toContain("没有查到条码");
    expect(screen.getByTestId("ai-error").textContent).toContain("0 千卡");
  });
});
