import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { Text } from "grok/canvas";
import { COMMON_FOODS, SHORTCUTS, hitFromShortcut, looksLikeLabel, offToFood, pendingFromLabel, recallBarcode, rememberBarcode, type BarHit } from "./commonFoods";
import { MEALS, type Food } from "./logic";
import { LABEL_SYS, addLocalHit, buildChatMessages, callAiRaw, entriesFromPending, fallbackTurn, loadAi, looksLikeApiKey, newPendingId, pendingFromHit, pendingToFood, per100, resolveTurn, scalePending, upsertPending, withBase, type PendingFood } from "./aiChat";

const MEAL_C: Record<string, string> = { "早餐": "#ff9f0a", "训练后": "#30d158", "午餐": "#0a84ff", "晚餐": "#bf5af2", "加餐": "#ff375f" };

type Msg = { id: string; role: "user" | "assistant"; text: string };
type BarFood = { n: string; k: number; p: number; c: number; f: number; g: number; u: string; t?: string; mine?: boolean };

const downscale = (file: File): Promise<string> => new Promise((res, rej) => {
  const u = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    const s = Math.min(1, 1600 / Math.max(im.width, im.height));
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

async function readBarcodeFile(file: File): Promise<string> {
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const rd = new BrowserMultiFormatReader();
    const url = URL.createObjectURL(file);
    try { return (await rd.decodeFromImageUrl(url)).getText(); }
    finally { URL.revokeObjectURL(url); }
  } catch { return ""; }
}

function answerKnown(text: string): string {
  const food = COMMON_FOODS.find((f) => f.aliases.some((a) => a.length >= 2 && text.includes(a))) || null;
  if (!food) return "这是营养问题，没有记成食物。可以到设置里填写智谱 Key，让模型一起回答。";
  return `${food.name}大约每100g ${Math.round(food.k)} kcal，蛋白 ${food.p}g、碳水 ${food.c}g、脂肪 ${food.f}g。这是内置估算，没有写入饮食记录。`;
}

export function AiChat({ date, meal, today, setDate, setMeal, flash, onCommit, onRemember, compact = false, foods = [] }: {
  date: string;
  meal: string;
  today: string;
  setDate: (d: string) => void;
  setMeal: (m: string) => void;
  flash: (m: string) => void;
  onCommit: (items: PendingFood[], when: string) => void;
  onRemember: (foods: BarFood[]) => void;
  compact?: boolean;
  foods?: readonly Food[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState<PendingFood[]>(loadPending);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [bf, setBf] = useState<BarFood | null>(null);
  const [scan, setScan] = useState(false);
  const [foodsOpen, setFoodsOpen] = useState(false);
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
  const applyTurn = (turn: { pending: PendingFood[]; reply: string; date: string | null; intent: string; error?: string }) => {
    if (turn.error) setErr(`${turn.error}。饮食记录没有改动。`);
    setPending(turn.pending);
    if (turn.date && turn.intent !== "chat") { dateRef.current = turn.date; setDate(turn.date); }
    if (turn.intent !== "chat") {
      const remembered = turn.pending.filter((p) => !p.missing).map(pendingToFood);
      if (remembered.length) onRemember(remembered);
    }
    pushBot(turn.reply || (turn.error ? "没有解析出内容，饮食记录没有改动。" : "…"));
  };

  const sendText = async (text: string) => {
    const shown = text.trim();
    if (!shown || busy) { if (!shown) setErr("先说一下吃了什么，或问一个营养问题"); return; }
    if (looksLikeApiKey(shown)) { setErr("请到设置里填写智谱 Key。对话不会保存或上传这段文字。"); return; }
    setErr(""); setBusy(true); setTxt("");
    setMessages((m) => [...m, { id: newPendingId(), role: "user", text: shown }]);
    const cfg = loadAi();
    const localOnly = !cfg.key.trim();
    try {
      if (localOnly || looksLikeLabel(shown)) {
        if (/[?？]|吗|多少|为什么|热量高/.test(shown) && !/吃了|记一下|再加|改成/.test(shown)) {
          pushBot(answerKnown(shown));
          return;
        }
        const fb = fallbackTurn(pendingRef.current, shown, today, foods);
        if (fb) { applyTurn(fb); return; }
        if (localOnly) {
          const msg = "还没有设置智谱 API Key，内置表也没认出食物。可以换个说法，或到设置填写（只保存在本机）。";
          setErr(msg); pushBot(msg); return;
        }
      }
      const hist = messages.map((m) => ({ role: m.role, content: m.text }));
      const raw = await callAiRaw(cfg, buildChatMessages(pendingRef.current, hist, shown), cfg.tm);
      applyTurn(resolveTurn(pendingRef.current, shown, raw, today, foods));
    } catch (e) {
      const fb = fallbackTurn(pendingRef.current, shown, today, foods);
      if (fb) { applyTurn({ ...fb, reply: `模型暂时不可用，已改用内置食物表。${fb.reply}` }); return; }
      const msg = e instanceof Error ? e.message : "出错了";
      setErr(msg);
      pushBot(msg);
    } finally { setBusy(false); }
  };

  const onPhoto = async (file: File) => {
    if (busy) return;
    const hint = txt.trim();
    setErr(""); setBusy(true); setTxt("");
    setMessages((m) => [...m, { id: newPendingId(), role: "user", text: hint || "（拍了营养成分表）" }]);
    try {
      const code = await readBarcodeFile(file);
      const known = code ? recallBarcode(code) : null;
      if (known && !hint) {
        const item = pendingFromHit({ name: known.n, grams: 100, kcal: known.k, protein: known.p, carbs: known.c, fat: known.f });
        item.source = "barcode";
        setPending((ps) => upsertPending(ps, item));
        pushBot(`从照片读到条码，对上「${known.n}」。每100g约 ${Math.round(known.k)} kcal。可改克数，点确认才写入。`);
        return;
      }
      const cfg = loadAi();
      if (!cfg.key.trim()) {
        if (known) {
          const grams = hint ? (fallbackTurn([], hint, today, foods)?.pending[0]?.grams || 100) : 100;
          const m = grams / 100;
          const item = pendingFromHit({ name: known.n, grams, kcal: known.k * m, protein: known.p * m, carbs: known.c * m, fat: known.f * m });
          item.source = "barcode";
          setPending((ps) => upsertPending(ps, item));
          pushBot(`条码是「${known.n}」，按 ${grams}g 估算约 ${Math.round(known.k * m)} kcal。点确认才写入。`);
          return;
        }
        const msg = "这张图没有对上已保存的条码。认营养成分表需要在设置里填写智谱 API Key（只保存在本机）。";
        setErr(msg); pushBot(msg); return;
      }
      const img = await downscale(file);
      const raw = await callAiRaw(cfg, [
        { role: "system", content: LABEL_SYS },
        { role: "user", content: [{ type: "image_url", image_url: { url: img } }, { type: "text", text: hint || "只读取包装上的营养成分表。读不到就明确说读不到，不要填 0。" }] },
      ], cfg.vm);
      const label = pendingFromLabel(`${raw}\n${hint}`, hint);
      const item = pendingFromHit(label);
      if (label.barcode && !label.missing && label.grams > 0) {
        const per = 100 / label.grams;
        rememberBarcode(label.barcode, { n: label.name, k: label.kcal * per, p: label.protein * per, c: label.carbs * per, f: label.fat * per });
      }
      setPending((ps) => {
        const i = ps.findIndex((p) => p.name === item.name);
        if (i < 0) return [...ps, item];
        const next = [...ps];
        next[i] = { ...item, id: ps[i].id, meal: ps[i].meal || item.meal };
        return next;
      });
      if (label.missing) setErr("营养未识别，请补充");
      pushBot(label.reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "图片没有读成";
      setErr(`${msg}。营养未识别，请补充。`);
      pushBot("营养未识别，请补充。没有按 0 千卡写入。");
    } finally { setBusy(false); }
  };

  const confirm = () => {
    if (lock.current || busy || !pendingRef.current.length) return;
    const ready = pendingRef.current.filter((p) => !p.missing).map((p) => ({ ...p, meal: p.meal || meal }));
    const held = pendingRef.current.filter((p) => p.missing);
    if (!ready.length) { setErr("营养未识别，请补充"); return; }
    lock.current = true;
    const when = dateRef.current;
    pendingRef.current = held;
    setPending(held);
    onCommit(ready, when);
    const meals = [...new Set(ready.map((i) => i.meal || meal))];
    pushBot(`已添加到 ${when}${meals.length === 1 ? ` ${meals[0]}` : ""}，共 ${ready.length} 样。数字是估算，可点撤销。`);
    if (held.length) setErr("营养未识别，请补充");
    lock.current = false;
  };

  const showBar = (food: BarHit, note: string) => {
    setBf({ ...food, g: 100, u: "100g", t: "条码" });
    pushBot(note);
  };
  const lookup = async (c: string) => {
    const cc = c.replace(/\D/g, "");
    if (cc.length < 8) { if (cc) setErr("条码至少要 8 位，没有添加。"); return; }
    setErr(""); setBf(null); setBusy(true);
    const local = recallBarcode(cc);
    if (local) { showBar(local, `条码 ${cc}：${local.n}，每100g约 ${Math.round(local.k)} kcal。放入待添加后，点确认才会写入。`); setBusy(false); return; }
    const urls = [`https://world.openfoodfacts.org/api/v2/product/${cc}.json`, `https://cn.openfoodfacts.org/api/v2/product/${cc}.json`];
    try {
      let food: BarHit | null = null;
      for (const url of urls) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          food = offToFood(await r.json());
          if (food) break;
        } catch { /* try the next catalog */ }
      }
      if (!food) { setErr(`没有查到条码 ${cc} 的营养数据，没有添加。可以拍营养成分表，或手动补充。不会记成 0 千卡。`); pushBot(`没有查到条码 ${cc}。`); return; }
      rememberBarcode(cc, food);
      showBar(food, `查到「${food.n}」，每100g约 ${Math.round(food.k)} kcal。点放入待添加，再确认才会写入。`);
    } finally { setBusy(false); }
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
    <div data-testid="ai-chat" style={{ border: compact ? "none" : "1px solid #34373c", borderRadius: compact ? 0 : 16, padding: compact ? 0 : 12, display: "flex", flexDirection: "column", gap: 10, background: compact ? "transparent" : "#141416" }}>
      <div data-testid="portion-bar" className="ct-sc" aria-label="份量快捷">
        {SHORTCUTS.map((s) => <button type="button" key={s.id} data-testid={`sc-${s.id}`} onClick={() => { const hit = hitFromShortcut(s.id); if (!hit) return; setPending((ps) => addLocalHit(ps, { ...hit, meal })); }}>{s.label}</button>)}
      </div>
      <div>
        <button type="button" data-testid="common-toggle" aria-expanded={foodsOpen} onClick={() => setFoodsOpen(!foodsOpen)} style={{ minHeight: 36, padding: 0, border: "none", background: "none", color: "#8e8e93", fontSize: 13 }}>{foodsOpen ? "收起常见食物" : "常见食物"}</button>
        {foodsOpen && <div data-testid="common-foods" className="ct-foods" style={{ marginTop: 6 }}>{COMMON_FOODS.map((f) => <button type="button" key={f.name} onClick={() => { const hit = hitFromShortcut(SHORTCUTS.find((s) => s.food === f.name)?.id || "") || { name: f.name, grams: f.grams, kcal: f.k * f.grams / 100, protein: f.p * f.grams / 100, carbs: f.c * f.grams / 100, fat: f.f * f.grams / 100 }; setPending((ps) => addLocalHit(ps, { ...hit, meal })); }}>{`${f.portion}${f.aliases[0]}`}</button>)}</div>}
      </div>
      {!compact && <div style={{ color: "#fff", fontWeight: 700 }}>对话记录 · 多种食物</div>}
      {!compact && <div style={{ color: "#8e8e93", fontSize: 13, lineHeight: 1.5 }}>先聊天整理，数字是估算。点「确认添加」才会写入 {date}{date === today ? "（今天）" : ""}，而且只写一次。问营养问题不会记成食物。</div>}
      {!compact && <div ref={box} className="ct-chat" role="log" aria-live="polite">
        {messages.length === 0 && <div className="ct-bub bot">可以说「早餐吃了米饭200克、两个鸡蛋」，接着「米饭改成150克」或「再加两个鸡蛋」。也可以问「鸡胸肉热量高吗」。</div>}
        {messages.map((m) => <div key={m.id} className={`ct-bub ${m.role === "user" ? "user" : "bot"}`}>{m.text}</div>)}
        {busy && <div className="ct-bub bot" role="status">正在估算…</div>}
      </div>}
      {err && <div data-testid="ai-error" role="alert" style={{ color: "#ffb020", fontSize: 14 }}>{err}</div>}
      {pending.length > 0 && (
        <div data-testid="ai-pending" className="ct-pend">
          <div style={{ color: "#fff", fontWeight: 700 }}>{`待添加 ${pending.length} 样 · ${date} · 约 ${kcal} kcal`}</div>
          <div style={{ color: "#8e8e93", fontSize: 12 }}>还没写入饮食记录。克数改动会按原估算比例缩放。同名食物只会留一条。</div>
          {pending.map((p) => (
            <div key={p.id} data-testid={`pend-${p.name}`} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ flex: "1 1 140px", color: "#fff", fontSize: 15 }}>{p.name}<span style={{ color: p.missing ? "#ffb020" : "#8e8e93", fontSize: 12 }}>{p.missing ? " · 营养未识别，请补充" : ` · ${p.source === "barcode" ? "条码" : p.source === "table" ? "内置" : "估算"} · 这份 ${Math.round(p.kcal)} kcal · 蛋白 ${p.protein.toFixed(1)} · 碳水 ${p.carbs.toFixed(1)} · 脂肪 ${p.fat.toFixed(1)} · 约 ${per100(p)}/100g`}</span></span>
              <input aria-label={`${p.name} 克数`} inputMode="decimal" value={String(Math.round(p.grams * 10) / 10)} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = parseFloat(e.target.value); if (!(v >= 0)) return; setPending((ps) => ps.map((x) => x.id === p.id ? scalePending(x, v) : x)); }} style={{ width: 72, minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }} />
              <span style={{ color: "#8e8e93" }}>克</span>
              <select aria-label={`${p.name} 餐次`} value={p.meal || meal} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPending((ps) => ps.map((x) => x.id === p.id ? { ...x, meal: e.target.value } : x))} style={{ minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }}>
                {MEALS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <button type="button" aria-label={`移除 ${p.name}`} onClick={() => setPending((ps) => ps.filter((x) => x.id !== p.id))} style={{ minWidth: 44, minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#1c1c1e", color: "#fff" }}>✕</button>
              {p.missing && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, width: "100%" }}>
                {([["kcal", "热量"], ["protein", "蛋白"], ["carbs", "碳水"], ["fat", "脂肪"]] as const).map(([key, lab]) => <input key={key} aria-label={`${p.name} ${lab}`} inputMode="decimal" placeholder={lab} value={p[key] > 0 ? String(Math.round(p[key] * 10) / 10) : ""} onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const raw = e.target.value;
                  const v = raw === "" ? 0 : parseFloat(raw);
                  if (raw !== "" && !isFinite(v)) return;
                  setPending((ps) => ps.map((x) => {
                    if (x.id !== p.id) return x;
                    const next = { ...x, [key]: v };
                    const kcal = next.kcal > 0 ? next.kcal : next.protein * 4 + next.carbs * 4 + next.fat * 9;
                    const missing = !(kcal > 0) && !(next.protein > 0) && !(next.carbs > 0) && !(next.fat > 0);
                    return withBase({ ...next, kcal: missing ? 0 : kcal, missing });
                  }));
                }} style={{ width: 72, minHeight: 40, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }} />)}
              </div>}
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" data-testid="ai-confirm" onClick={confirm} style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none", background: "#ff9f0a", color: "#111", fontWeight: 700, fontSize: 16 }}>{`确认添加到 ${date}`}</button>
            <button type="button" onClick={() => { setPending([]); pushBot("已清空待添加，饮食记录没有改动。"); }} style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #34373c", background: "#1c1c1e", color: "#fff" }}>清空待添加</button>
          </div>
        </div>
      )}
      {!compact && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MEALS.map((m) => <button type="button" key={m} onClick={() => setMeal(m)} style={{ minHeight: 36, padding: "0 10px", borderRadius: 999, border: "none", background: m === meal ? MEAL_C[m] : "#1c1c1e", color: m === meal ? "#111" : "#eee", fontWeight: 600 }}>{m}</button>)}
      </div>}
      {!compact && <textarea data-testid="ai-txt" value={txt} placeholder="例如：午餐一碗饭、两个鸡蛋、一掌鸡胸。米饭改成150克。或：九牛巴氏鲜奶200毫升" rows={2} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(txt); } }} style={{ minHeight: 64, padding: 10, borderRadius: 12, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16 }} />}
      {!compact && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" data-testid="ai-send" disabled={busy} onClick={() => sendText(txt)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none", background: "#0a84ff", color: "#fff", fontWeight: 700, fontSize: 16, opacity: busy ? 0.6 : 1 }}>发送</button>
        <label style={lab}>拍照识标签<input data-testid="photo-input" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); }} /></label>
        <button type="button" onClick={() => scan ? stopCam() : startCam()} style={{ ...lab, background: "#1c1c1e" }}>{scan ? "停止扫码" : "扫条码"}</button>
        <label style={{ ...lab, background: "#1c1c1e" }}>相册条码<input data-testid="barcode-file" type="file" accept="image/*" style={{ display: "none" }} onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; readBarcodeFile(f).then((c) => { if (c) { setCode(c.replace(/\D/g, "")); lookup(c); } else setErr("这张图里没有认出条码。可以改拍营养成分表，或手动输入。"); }); }} /></label>
      </div>}
      {scan && <video ref={vid} playsInline muted style={{ width: "100%", maxHeight: 240, borderRadius: 10, background: "#000" }} />}
      {!compact && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}><span style={{ color: "#8e8e93", fontSize: 13 }}>手动输入条码</span><input data-testid="barcode-code" inputMode="numeric" value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6959909102831" style={{ minHeight: 44, borderRadius: 10, border: "1px solid #34373c", background: "#0b0b0b", color: "#fff", fontSize: 16, padding: "0 10px" }} /></label>
        <button type="button" data-testid="barcode-lookup" onClick={() => lookup(code)} style={{ ...lab, background: "#1c1c1e" }}>查询</button>
      </div>}
      {bf && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Text>{`${bf.n} · 每100g ${Math.round(bf.k)} kcal · 蛋白 ${bf.p}g · 碳水 ${bf.c}g · 脂肪 ${bf.f}g`}</Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" data-testid="barcode-pending" onClick={addBarcode} style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none", background: "#ff9f0a", color: "#111", fontWeight: 700 }}>放入待添加</button>
          <button type="button" onClick={() => { onRemember([{ ...bf, mine: true }]); flash("已存入我的食物"); }} style={{ ...lab, background: "#1c1c1e" }}>存为我的食物</button>
        </div>
      </div>}
    </div>
  );
}
