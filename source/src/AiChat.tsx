import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { Text } from "grok/canvas";
import { MEALS } from "./logic";
import { buildChatMessages, callAiRaw, entriesFromPending, loadAi, looksLikeApiKey, newPendingId, pendingToFood, per100, resolveTurn, scalePending, upsertPending, type PendingFood } from "./aiChat";

const MEAL_C: Record<string, string> = { "早餐": "#ff9f0a", "训练后": "#30d158", "午餐": "#0a84ff", "晚餐": "#bf5af2", "加餐": "#ff375f" };

type Msg = { id: string; role: "user" | "assistant"; text: string };
type BarFood = { n: string; k: number; p: number; c: number; f: number; g: number; u: string; t?: string; mine?: boolean };

const downscale = (file: File): Promise<string> => new Promise((res, rej) => {
  const u = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    const s = Math.min(1, 1024 / Math.max(im.width, im.height));
    const c = document.createElement("canvas");
    c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    URL.revokeObjectURL(u);
    res(c.toDataURL("image/jpeg", 0.8));
  };
  im.onerror = () => rej(new Error("图片读取失败"));
  im.src = u;
});

function loadPending(): PendingFood[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem("ct_ai_pending_v27") || "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && x.name && x.id) : [];
  } catch { return []; }
}

export function AiChat({ date, meal, today, setDate, setMeal, flash, onCommit, onRemember }: {
  date: string;
  meal: string;
  today: string;
  setDate: (d: string) => void;
  setMeal: (m: string) => void;
  flash: (m: string) => void;
  onCommit: (items: PendingFood[], when: string) => void;
  onRemember: (foods: BarFood[]) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState<PendingFood[]>(loadPending);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [bf, setBf] = useState<BarFood | null>(null);
  const [scan, setScan] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const vid = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const lock = useRef(false);
  const pendingRef = useRef(pending);
  const dateRef = useRef(date);
  pendingRef.current = pending;
  dateRef.current = date;

  useEffect(() => { try { sessionStorage.setItem("ct_ai_pending_v27", JSON.stringify(pending)); } catch { /* ignore */ } }, [pending]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages, busy]);
  useEffect(() => () => stopRef.current?.(), []);

  const pushBot = (text: string) => setMessages((m) => [...m, { id: newPendingId(), role: "assistant", text }]);

  const sendText = async (text: string, img?: string) => {
    const shown = text.trim() || (img ? "（发了一张图片）" : "");
    if (!shown || busy) { if (!shown) setErr("先说一下吃了什么，或问一个营养问题"); return; }
    if (!img && looksLikeApiKey(shown)) { setErr("请到设置里填写智谱 Key。对话不会保存或上传这段文字。"); return; }
    setErr(""); setBusy(true); setTxt("");
    setMessages((m) => [...m, { id: newPendingId(), role: "user", text: shown }]);
    try {
      const cfg = loadAi();
      const hist = messages.map((m) => ({ role: m.role, content: m.text }));
      let req = buildChatMessages(pendingRef.current, hist, shown) as { role: string; content: unknown }[];
      if (img) {
        req = [...req.slice(0, -1), { role: "user", content: [{ type: "image_url", image_url: { url: img } }, { type: "text", text: text.trim() || "识别图片里的食物。按 record 给出待添加清单。这只是估算，不要假设已经写入记录。" }] }];
      }
      const raw = await callAiRaw(cfg, req, img ? cfg.vm : cfg.tm);
      const turn = resolveTurn(pendingRef.current, shown, raw, today);
      if (turn.error) setErr(`${turn.error}。饮食记录没有改动。`);
      setPending(turn.pending);
      if (turn.date && turn.intent !== "chat") { dateRef.current = turn.date; setDate(turn.date); }
      if (turn.intent !== "chat") {
        const foods = turn.pending.filter((p) => p.source === "ai").map(pendingToFood);
        if (foods.length) onRemember(foods);
      }
      pushBot(turn.reply || (turn.error ? "没有解析出内容，饮食记录没有改动。" : "…"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "出错了";
      setErr(msg);
      pushBot(msg);
    } finally { setBusy(false); }
  };

  const confirm = () => {
    if (lock.current || busy || !pendingRef.current.length) return;
    lock.current = true;
    const items = pendingRef.current.map((p) => ({ ...p, meal: p.meal || meal }));
    const when = dateRef.current;
    pendingRef.current = [];
    setPending([]);
    onCommit(items, when);
    const meals = [...new Set(items.map((i) => i.meal || meal))];
    pushBot(`已添加到 ${when}${meals.length === 1 ? ` ${meals[0]}` : ""}，共 ${items.length} 样。数字是估算，可点撤销。`);
    lock.current = false;
  };

  const lookup = (c: string) => {
    const cc = c.replace(/\D/g, "");
    if (!cc) return;
    setErr(""); setBf(null); setBusy(true);
    fetch(`https://world.openfoodfacts.org/api/v2/product/${cc}.json`).then((r) => r.json()).then((j: { status?: number; product?: { product_name?: string; product_name_zh?: string; brands?: string; nutriments?: Record<string, number> } }) => {
      const p = j && j.status === 1 ? j.product : null;
      const nu = p?.nutriments || {};
      if (!p) { setErr(`未找到条码 ${cc} 的商品，可手动添加`); return; }
      const kc = nu["energy-kcal_100g"] ?? (nu["energy_100g"] ? nu["energy_100g"] / 4.184 : 0);
      setBf({ n: String(p.product_name_zh || p.product_name || `条码${cc}`).slice(0, 40) + (p.brands ? `（${String(p.brands).split(",")[0].slice(0, 20)}）` : ""), k: Math.round(kc || 0), p: +(nu.proteins_100g || 0).toFixed(1), c: +(nu.carbohydrates_100g || 0).toFixed(1), f: +(nu.fat_100g || 0).toFixed(1), g: 100, u: "100g", t: "条码" });
    }).catch(() => setErr("网络错误，条码查询失败")).finally(() => setBusy(false));
  };

  const stopCam = () => { stopRef.current?.(); stopRef.current = null; setScan(false); };
  const startCam = async () => {
    setErr(""); setScan(true);
    await new Promise((r) => setTimeout(r, 50));
    const v = vid.current; if (!v) return;
    const done = (c: string) => { stopCam(); setCode(c); lookup(c); };
    try {
      const BD = (window as unknown as { BarcodeDetector?: new (o: unknown) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (BD) {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        v.srcObject = s; await v.play();
        const d = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        let on = true;
        stopRef.current = () => { on = false; s.getTracks().forEach((t) => t.stop()); };
        const tick = async () => { if (!on) return; try { const r = await d.detect(v); if (r[0]) { done(r[0].rawValue); return; } } catch { /* retry */ } setTimeout(tick, 250); };
        tick();
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const rd = new BrowserMultiFormatReader();
        const ctl = await rd.decodeFromVideoDevice(undefined, v, (res: { getText: () => string } | undefined) => { if (res) done(res.getText()); });
        stopRef.current = () => ctl.stop();
      }
    } catch { stopCam(); setErr("无法打开摄像头，请手动输入条码"); }
  };

  const addBarcode = () => {
    if (!bf) return;
    const item = upsertPending(pending, {
      id: newPendingId(), name: bf.n, grams: 100, kcal: bf.k, protein: bf.p, carbs: bf.c, fat: bf.f, meal, source: "barcode",
      baseGrams: 100, baseKcal: bf.k, baseProtein: bf.p, baseCarbs: bf.c, baseFat: bf.f,
    }) ;
    setPending(item);
    pushBot(`「${bf.n}」放进待添加了。点确认添加才会写入 ${date}。`);
  };

  const totals = entriesFromPending(pending, meal);
  const kcal = Math.round(totals.reduce((a, e) => a + e.k, 0));
  const lab: CSSProperties = { minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 10, border: "1px solid #34373c", color: "#f2f3f5", fontSize: 15, cursor: "pointer" };

  return (
    <div data-testid="ai-chat" style={{ border: "1px solid #34373c", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 10, background: "#141416" }}>
      <div style={{ color: "#fff", fontWeight: 700 }}>对话记录 · 多种食物</div>
      <div style={{ color: "#8e8e93", fontSize: 13, lineHeight: 1.5 }}>先聊天整理，数字是估算。点「确认添加」才会写入 {date}{date === today ? "（今天）" : ""}，而且只写一次。问营养问题不会记成食物。</div>
      <div ref={box} className="ct-chat" role="log" aria-live="polite">
        {messages.length === 0 && <div className="ct-bub bot">可以说「早餐吃了米饭200克、两个鸡蛋」，接着「米饭改成150克」或「再加两个鸡蛋」。也可以问「鸡胸肉热量高吗」。</div>}
        {messages.map((m) => <div key={m.id} className={`ct-bub ${m.role === "user" ? "user" : "bot"}`}>{m.text}</div>)}
        {busy && <div className="ct-bub bot" role="status">正在估算…</div>}
      </div>
      {err && <div data-testid="ai-error" role="alert" style={{ color: "#ffb020", fontSize: 14 }}>{err}</div>}
      {pending.length > 0 && (
        <div data-testid="ai-pending" className="ct-pend">
          <div style={{ color: "#fff", fontWeight: 700 }}>{`待添加 ${pending.length} 样 · ${date} · 约 ${kcal} kcal`}</div>
          <div style={{ color: "#8e8e93", fontSize: 12 }}>还没写入饮食记录。克数改动会按原估算比例缩放。同名食物只会留一条。</div>
          {pending.map((p) => (
            <div key={p.id} data-testid={`pend-${p.name}`} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ flex: "1 1 140px", color: "#fff", fontSize: 15 }}>{p.name}<span style={{ color: "#8e8e93", fontSize: 12 }}>{` · ${p.source === "barcode" ? "条码" : "估算"} · 这份 ${Math.round(p.kcal)} kcal · 蛋白 ${p.protein.toFixed(1)} · 碳水 ${p.carbs.toFixed(1)} · 脂肪 ${p.fat.toFixed(1)} · 约 ${per100(p)}/100g`}</span></span>
              <input aria-label={`${p.name} 克数`} inputMode="decimal" value={String(Math.round(p.grams * 10) / 10)} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = parseFloat(e.target.value); if (!(v >= 0)) return; setPending((ps) => ps.map((x) => x.id === p.id ? scalePending(x, v) : x)); }} style={{ width: 72, minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }} />
              <span style={{ color: "#8e8e93" }}>克</span>
              <select aria-label={`${p.name} 餐次`} value={p.meal || meal} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPending((ps) => ps.map((x) => x.id === p.id ? { ...x, meal: e.target.value } : x))} style={{ minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }}>
                {MEALS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <button type="button" aria-label={`移除 ${p.name}`} onClick={() => setPending((ps) => ps.filter((x) => x.id !== p.id))} style={{ minWidth: 44, minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#1c1c1e", color: "#fff" }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" data-testid="ai-confirm" onClick={confirm} style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none", background: "#ff9f0a", color: "#111", fontWeight: 700, fontSize: 16 }}>{`确认添加到 ${date}`}</button>
            <button type="button" onClick={() => { setPending([]); pushBot("已清空待添加，饮食记录没有改动。"); }} style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #34373c", background: "#1c1c1e", color: "#fff" }}>清空待添加</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MEALS.map((m) => <button type="button" key={m} onClick={() => setMeal(m)} style={{ minHeight: 36, padding: "0 10px", borderRadius: 999, border: "none", background: m === meal ? MEAL_C[m] : "#1c1c1e", color: m === meal ? "#111" : "#eee", fontWeight: 600 }}>{m}</button>)}
      </div>
      <textarea data-testid="ai-txt" value={txt} placeholder="例如：午餐米饭200克、鸡胸150克、西兰花。米饭改成150克。再加两个鸡蛋。" rows={2} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(txt); } }} style={{ minHeight: 64, padding: 10, borderRadius: 12, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" data-testid="ai-send" disabled={busy} onClick={() => sendText(txt)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none", background: "#0a84ff", color: "#fff", fontWeight: 700, fontSize: 16, opacity: busy ? 0.6 : 1 }}>发送</button>
        <label style={lab}>拍照识别<input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) downscale(f).then((d) => sendText(txt, d)).catch((x: Error) => setErr(x.message)); }} /></label>
        <button type="button" onClick={() => scan ? stopCam() : startCam()} style={{ ...lab, background: "#1c1c1e" }}>{scan ? "停止扫码" : "扫条码"}</button>
      </div>
      {scan && <video ref={vid} playsInline muted style={{ width: "100%", maxHeight: 240, borderRadius: 10, background: "#000" }} />}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}><span style={{ color: "#8e8e93", fontSize: 13 }}>手动输入条码</span><input inputMode="numeric" value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6901234567890" style={{ minHeight: 44, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16, padding: "0 10px" }} /></label>
        <button type="button" onClick={() => lookup(code)} style={{ ...lab, background: "#1c1c1e" }}>查询</button>
      </div>
      {bf && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Text>{`${bf.n} · 每100g ${bf.k} kcal · 蛋白 ${bf.p}g · 碳水 ${bf.c}g · 脂肪 ${bf.f}g`}</Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" data-testid="barcode-pending" onClick={addBarcode} style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none", background: "#ff9f0a", color: "#111", fontWeight: 700 }}>放入待添加</button>
          <button type="button" onClick={() => { onRemember([{ ...bf, mine: true }]); flash("已存入我的食物"); }} style={{ ...lab, background: "#1c1c1e" }}>存为我的食物</button>
        </div>
      </div>}
    </div>
  );
}
