import { formatShanghai, r0, type Food } from "./logic";

export type AiCfg = { key: string; base: string; tm: string; vm: string };
export const AI_DEF: AiCfg = { key: "", base: "https://open.bigmodel.cn/api/paas/v4", tm: "glm-4-flash", vm: "glm-4v-flash" };
export const MEAL_SET = new Set(["早餐", "训练后", "午餐", "晚餐", "加餐"]);

export type PendingFood = {
  id: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meal?: string;
  source: "ai" | "barcode";
  baseGrams: number;
  baseKcal: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
};

export type TurnResult = {
  intent: "record" | "revise" | "chat";
  pending: PendingFood[];
  reply: string;
  error?: string;
  date: string | null;
};

const AI_SYS = `你是中餐营养估算助手，在手机上用简短中文和用户聊天。
用户可能要记下几种食物，也可能只是问营养问题，或修改还没确认的待添加清单。
你看不到用户的历史饮食记录、体重、隐私日志，禁止编造“你今天已经吃了多少”。
所有热量和营养都是估算，不是检测结果。
只输出严格 JSON，不要 markdown，不要解释在 JSON 外面：
{"intent":"record"|"revise"|"chat","reply":"给用户的简短中文","pending":[{"name":"食物","grams":数字,"kcal":数字,"protein":数字,"carbs":数字,"fat":数字,"meal":"早餐|训练后|午餐|晚餐|加餐|"}]|null}
规则：
- record：用户在描述要记下的食物，可以一次多种。pending 是合并后的完整待添加列表。
- revise：用户在改待添加（改克数、换食物、删掉、再加）。pending 仍是完整列表。
- chat：纯问题、建议、比较、闲聊。pending 必须为 null。不要把问题里提到的食物写进 pending。
- 每种食物只出现一次。grams 是该食物合计克数。kcal、protein、carbs、fat 是这一份的总量，不是每100克。
- “两个鸡蛋”写成一条「鸡蛋」约100克，不要写成两条。一个鸡蛋约50克，一碗熟米饭约200克。
- 用户没说某一餐时 meal 用空字符串。不要决定日期。
- reply 提醒这些是估算，而且还没写入饮食记录，需要用户点确认添加。`;

export function loadAi(): AiCfg {
  try { return { ...AI_DEF, ...JSON.parse(localStorage.getItem("fl_ai") || "{}") }; }
  catch { return { ...AI_DEF }; }
}

let seq = 1;
export function newPendingId(): string { return `p${Date.now().toString(36)}${seq++}`; }

export function normName(s: string): string { return s.trim().toLowerCase().replace(/\s+/g, ""); }

export function classifyUserText(text: string): "question" | "food" | "unclear" {
  const t = text.trim();
  if (!t) return "unclear";
  if (/清空|都不要了|不用记了|取消这些/.test(t)) return "food";
  const explicit = /记一下|记录|再加|加上|还要|再来|改成|改为|换成|去掉|删掉|不要了/.test(t);
  const question = /[?？]|吗|多少|为什么|怎么样|如何|建议|热量高|够不够|超了吗|什么是|区别|可以吃/.test(t);
  if (question && !explicit) return "question";
  if (explicit || /吃了|吃的|早餐|午餐|晚餐|加餐|训练后|克|ｇ|\dg\b|碗|个|份/.test(t)) return "food";
  if (question) return "question";
  return "unclear";
}

export function looksLikeApiKey(text: string): boolean {
  const t = text.trim();
  if (t.length < 24 || t.length > 200 || /\s/.test(t)) return false;
  return /^[A-Za-z0-9._\-]+$/.test(t) && /[A-Za-z]/.test(t) && /\d/.test(t);
}

export function dateHint(text: string, today: string): string | null {
  if (/前天/.test(text)) return shiftHint(today, -2);
  if (/昨天/.test(text)) return shiftHint(today, -1);
  if (/今天/.test(text)) return today;
  return null;
}

function shiftHint(today: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m) return today;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  const z = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`;
}

export function withBase(p: Omit<PendingFood, "baseGrams" | "baseKcal" | "baseProtein" | "baseCarbs" | "baseFat"> & Partial<Pick<PendingFood, "baseGrams" | "baseKcal" | "baseProtein" | "baseCarbs" | "baseFat">>): PendingFood {
  return {
    ...p,
    baseGrams: p.baseGrams ?? (p.grams || 100),
    baseKcal: p.baseKcal ?? p.kcal,
    baseProtein: p.baseProtein ?? p.protein,
    baseCarbs: p.baseCarbs ?? p.carbs,
    baseFat: p.baseFat ?? p.fat,
  };
}

export function scalePending(p: PendingFood, grams: number): PendingFood {
  const base = p.baseGrams > 0 ? p.baseGrams : 100;
  const m = grams / base;
  return { ...p, grams, kcal: p.baseKcal * m, protein: p.baseProtein * m, carbs: p.baseCarbs * m, fat: p.baseFat * m };
}

function num(x: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (x[k] != null && x[k] !== "") {
      const v = parseFloat(String(x[k]));
      if (isFinite(v) && v >= 0) return v;
    }
  }
  return 0;
}

function asItem(x: Record<string, unknown>, source: PendingFood["source"]): PendingFood | null {
  const name = String(x.name ?? x.食物 ?? x.名称 ?? "").trim().slice(0, 40);
  if (!name) return null;
  const mealRaw = String(x.meal ?? x.餐 ?? x.餐次 ?? "");
  const grams = num(x, ["grams", "g", "克"]) || 100;
  return withBase({
    id: newPendingId(),
    name,
    grams,
    kcal: num(x, ["kcal", "calories", "热量", "卡路里"]),
    protein: num(x, ["protein", "蛋白", "蛋白质"]),
    carbs: num(x, ["carbs", "carbohydrates", "碳水", "碳水化合物"]),
    fat: num(x, ["fat", "脂肪"]),
    meal: MEAL_SET.has(mealRaw) ? mealRaw : undefined,
    source,
  });
}

export function parseModelPayload(raw: string): { intent: TurnResult["intent"] | ""; reply: string; pending: PendingFood[] | null; items: PendingFood[]; ops: { op: string; name: string }[]; explicitPending: boolean } {
  let s = String(raw || "").replace(/```(?:json)?/gi, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  let o: unknown;
  try { o = JSON.parse(s); }
  catch {
    const m = s.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("AI返回内容无法解析");
    o = { items: JSON.parse(m[0]) };
  }
  if (Array.isArray(o)) o = { items: o };
  const rec = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
  const intentRaw = String(rec.intent || "");
  const intent = intentRaw === "record" || intentRaw === "revise" || intentRaw === "chat" ? intentRaw : "";
  const reply = String(rec.reply ?? rec.answer ?? "").trim().slice(0, 500);
  const explicitPending = Object.prototype.hasOwnProperty.call(rec, "pending");
  const readList = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => (x && typeof x === "object" ? x as Record<string, unknown> : null)).filter((x): x is Record<string, unknown> => !!x);
  const pendingRows = explicitPending && rec.pending != null ? readList(rec.pending) : [];
  const itemRows = readList(rec.items);
  const ops = [...pendingRows, ...itemRows].filter((x) => x.op).map((x) => ({ op: String(x.op), name: String(x.name || "") }));
  const pending = explicitPending ? (rec.pending == null ? null : pendingRows.map((x) => asItem(x, "ai")).filter((x): x is PendingFood => !!x)) : null;
  const items = (pending ? pendingRows : itemRows).map((x) => asItem(x, "ai")).filter((x): x is PendingFood => !!x);
  return { intent, reply, pending, items, ops, explicitPending };
}

function dedupeIncoming(items: PendingFood[]): PendingFood[] {
  const out: PendingFood[] = [];
  for (const it of items) {
    const i = out.findIndex((p) => normName(p.name) === normName(it.name));
    if (i < 0) { out.push({ ...it }); continue; }
    const echo = Math.abs(out[i].grams - it.grams) < 0.01 && sameMacros(out[i], it);
    if (echo) out[i] = { ...it, id: out[i].id };
    else out[i] = withBase({ ...out[i], grams: out[i].grams + it.grams, kcal: out[i].kcal + it.kcal, protein: out[i].protein + it.protein, carbs: out[i].carbs + it.carbs, fat: out[i].fat + it.fat, meal: it.meal || out[i].meal });
  }
  return out;
}

function sameMacros(a: PendingFood, b: PendingFood): boolean {
  return Math.abs(a.kcal - b.kcal) < 0.05 && Math.abs(a.protein - b.protein) < 0.05 && Math.abs(a.carbs - b.carbs) < 0.05 && Math.abs(a.fat - b.fat) < 0.05;
}

function reconcile(prev: PendingFood[], item: PendingFood): PendingFood {
  const old = prev.find((p) => normName(p.name) === normName(item.name));
  if (!old || !(old.grams > 0) || !(item.grams > 0) || item.grams === old.grams || !sameMacros(old, item)) return { ...item, id: old?.id || item.id };
  const scaled = scalePending({ ...old, baseGrams: old.grams, baseKcal: old.kcal, baseProtein: old.protein, baseCarbs: old.carbs, baseFat: old.fat }, item.grams);
  return { ...scaled, id: old.id, meal: item.meal || old.meal, source: item.source };
}

function upsert(prev: PendingFood[], incoming: PendingFood[]): PendingFood[] {
  const next = [...prev];
  for (const item of dedupeIncoming(incoming)) {
    const i = next.findIndex((p) => normName(p.name) === normName(item.name));
    const fixed = reconcile(prev, item);
    if (i < 0) next.push(fixed);
    else next[i] = fixed;
  }
  return next;
}

function keepUnmentioned(prev: PendingFood[], next: PendingFood[], userText: string): PendingFood[] {
  if (!/再加|加上|还要|再来|改成|改为|换成/.test(userText)) return next;
  const extra = prev.filter((p) => !next.some((n) => normName(n.name) === normName(p.name)) && !userText.includes(p.name));
  return [...next, ...extra];
}

export function resolveTurn(prev: PendingFood[], userText: string, raw: string, today: string): TurnResult {
  const local = classifyUserText(userText);
  const hinted = local === "question" ? null : dateHint(userText, today);
  let parsed: ReturnType<typeof parseModelPayload>;
  try { parsed = parseModelPayload(raw); }
  catch (e) { return { intent: "chat", pending: prev, reply: "", error: e instanceof Error ? e.message : "AI返回内容无法解析", date: null }; }
  if (local === "question" || parsed.intent === "chat") {
    const reply = parsed.reply || "这是营养问题，我不会把它记成食物，也不会改饮食记录。";
    return { intent: "chat", pending: prev, reply, date: null };
  }
  if (/清空|都不要了|不用记了|取消这些/.test(userText)) {
    return { intent: "revise", pending: [], reply: parsed.reply || "已清空待添加。饮食记录没有改动。", date: hinted };
  }
  const incoming = parsed.pending ?? parsed.items;
  let next = parsed.explicitPending && parsed.pending != null ? keepUnmentioned(prev, dedupeIncoming(parsed.pending).map((it) => reconcile(prev, it)), userText) : upsert(prev, incoming);
  for (const op of parsed.ops) {
    if (op.op === "remove" && op.name) next = next.filter((p) => normName(p.name) !== normName(op.name));
  }
  if (/去掉|删掉|不要/.test(userText)) {
    next = next.filter((p) => !userText.includes(p.name));
  }
  if (!next.length && !incoming.length) {
    return { intent: parsed.intent || "record", pending: prev, reply: parsed.reply || "没有识别出要记录的食物，待添加没有改。", date: hinted };
  }
  const reply = parsed.reply || `整理了 ${next.length} 样待添加。这是估算，点确认添加才会写入记录。`;
  return { intent: parsed.intent || "record", pending: next, reply, date: hinted };
}

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function buildChatMessages(pending: PendingFood[], history: ChatMsg[], userText: string): { role: string; content: string }[] {
  const brief = pending.map((p) => ({ name: p.name, grams: p.grams, kcal: r0(p.kcal), protein: +p.protein.toFixed(1), carbs: +p.carbs.toFixed(1), fat: +p.fat.toFixed(1), meal: p.meal || "" }));
  const note = `当前待添加（还没写入饮食记录）：${JSON.stringify(brief)}`;
  return [
    { role: "system", content: `${AI_SYS}\n${note}` },
    ...history.slice(-6),
    { role: "user", content: userText.slice(0, 2000) },
  ];
}

export function chatRequestBody(model: string, messages: { role: string; content: unknown }[]) {
  return { model, temperature: 0.2, messages };
}

export async function callAiRaw(cfg: AiCfg, messages: { role: string; content: unknown }[], modelName?: string): Promise<string> {
  if (!cfg.key || !cfg.key.trim()) throw new Error("还没有设置智谱 API Key，请到右上角设置填写（只保存在本机）");
  const base = (cfg.base || AI_DEF.base).replace(/\/+$/, "");
  const model = (modelName || cfg.tm || AI_DEF.tm).trim();
  let r: Response;
  try {
    r = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(chatRequestBody(model, messages)),
    });
  } catch { throw new Error("网络错误，无法连接智谱服务"); }
  if (r.status === 401 || r.status === 403) throw new Error("API Key 无效或无权限（401）");
  if (r.status === 429) throw new Error("请求太频繁或额度不足（429）");
  if (!r.ok) throw new Error(`智谱服务出错（${r.status}）`);
  const j = await r.json().catch(() => null) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = j?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text?: string }).text || "") : "")).join("") : "";
  if (!text.trim()) throw new Error("AI没有返回内容");
  return text;
}

export type AiItem = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
export async function callAi(cfg: AiCfg, text: string, img?: string): Promise<AiItem[]> {
  const content = img ? [{ type: "image_url", image_url: { url: img } }, { type: "text", text: text || "识别图片中的食物并估算营养" }] : text;
  const raw = await callAiRaw(cfg, [{ role: "system", content: AI_SYS }, { role: "user", content }], img ? cfg.vm : cfg.tm);
  const turn = resolveTurn([], text || "识别图片", raw, formatShanghai(new Date()));
  if (turn.error) throw new Error(turn.error);
  return turn.pending.map((p) => ({ name: p.name, grams: p.grams, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat }));
}

export function pendingToFood(p: PendingFood): Food {
  const g = p.grams > 0 ? p.grams : 100;
  const m = 100 / g;
  return { n: p.name, k: r0(p.kcal * m), p: +(p.protein * m).toFixed(1), c: +(p.carbs * m).toFixed(1), f: +(p.fat * m).toFixed(1), g, u: "100g", t: p.source === "barcode" ? "条码" : "AI", mine: true };
}

export function entriesFromPending(items: PendingFood[], fallbackMeal: string): { meal: string; name: string; grams: number; k: number; p: number; c: number; f: number }[] {
  return items.map((p) => ({
    meal: p.meal && MEAL_SET.has(p.meal) ? p.meal : fallbackMeal,
    name: p.name,
    grams: p.grams,
    k: p.kcal,
    p: p.protein,
    c: p.carbs,
    f: p.fat,
  }));
}

export function upsertPending(prev: PendingFood[], item: PendingFood): PendingFood[] {
  const i = prev.findIndex((p) => normName(p.name) === normName(item.name));
  if (i < 0) return [...prev, item];
  const next = [...prev];
  next[i] = { ...item, id: prev[i].id };
  return next;
}

export function per100(p: PendingFood): number {
  return p.grams > 0 ? r0(p.kcal * 100 / p.grams) : 0;
}
