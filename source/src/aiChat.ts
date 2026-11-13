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
  missing?: boolean;
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
- 每种食物只出现一次。grams 是该食物合计克数。kcal、protein、carbs、fat 是这一份的总量，不是每100克。若只知道每100克，按克数换算成这一份的总量再写入。
- 能量若是 kJ 或千焦，先除以 4.184 换成 kcal。kcal、千卡、大卡是同一单位。不要把 kJ 原数当作 kcal，也不要把营养写成 0。
- 用户已经给出克数就不要再追问。200、200g、200克、200ml、200毫升都算已经给出；牛奶等液体的 ml 按 1:1 当成克。输入框或上一句里已有克数时，直接使用，禁止回复「请输入克数」。
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

type Amount = { value: number; unit: string };

function parseAmount(raw: unknown): Amount | null {
  if (typeof raw === "number" && isFinite(raw) && raw >= 0) return { value: raw, unit: "" };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const n = o.value ?? o.val ?? o.值 ?? o.amount ?? o.数量;
    const u = o.unit ?? o.单位 ?? "";
    if (n != null) {
      const inner = parseAmount(n);
      if (!inner) return null;
      return { value: inner.value, unit: String(u || inner.unit).trim() };
    }
    return null;
  }
  const s = String(raw ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const m = s.match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const value = parseFloat(m[0]);
  if (!isFinite(value) || value < 0) return null;
  return { value, unit: s.slice((m.index ?? 0) + m[0].length).trim() };
}

function normKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, "").replace(/[()（）_]/g, "");
}

function isKj(unit: string, key: string): boolean {
  const u = normKey(unit);
  const k = normKey(key);
  if (/kcal|千卡|大卡|卡路里/.test(u)) return false;
  return /kj|千焦/.test(u) || /kj|千焦/.test(k);
}

type MacroKind = "kcal" | "p" | "c" | "f";

function classifyKey(key: string): { kind: MacroKind | null; per100: boolean } {
  const s = normKey(key);
  const per100 = /每100|per100/.test(s);
  if (/蛋白|protein/.test(s)) return { kind: "p", per100 };
  if (/碳水|carbohydrate|^carbs?$/.test(s)) return { kind: "c", per100 };
  if (/脂肪|^fat$/.test(s)) return { kind: "f", per100 };
  if (/能量|热量|energy|kcal|calorie|卡路里|千卡|大卡|千焦|^kj$/.test(s)) return { kind: "kcal", per100 };
  return { kind: null, per100 };
}

type MacroBag = { kcal: number; protein: number; carbs: number; fat: number; per100: boolean; found: boolean };

function emptyBag(): MacroBag {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, per100: false, found: false };
}

function takeMacro(bag: MacroBag, kind: MacroKind, amount: Amount, key: string, per100: boolean) {
  const v = amount.value;
  if (!(v > 0)) return;
  if (kind === "kcal") {
    const kj = isKj(amount.unit, key);
    if (kj) { if (!(bag.kcal > 0)) bag.kcal = v / 4.184; }
    else if (!(bag.kcal > 0) || /kcal|千卡|大卡|卡路里/.test(normKey(amount.unit + key))) bag.kcal = v;
  } else if (kind === "p" && !(bag.protein > 0)) bag.protein = v;
  else if (kind === "c" && !(bag.carbs > 0)) bag.carbs = v;
  else if (kind === "f" && !(bag.fat > 0)) bag.fat = v;
  if (per100) bag.per100 = true;
  bag.found = true;
}

function walkNutrition(node: unknown, bag: MacroBag, per100 = false, key = "") {
  if (node == null) return;
  const own = key ? classifyKey(key) : { kind: null as MacroKind | null, per100: false };
  const here = per100 || own.per100;
  if (own.kind) {
    const amount = parseAmount(node);
    if (amount) { takeMacro(bag, own.kind, amount, key, here); return; }
  }
  if (typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walkNutrition(n, bag, here)); return; }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (/^(name|食物|名称|meal|餐|餐次|grams|克数|克|id|intent|reply|op)$/i.test(k)) continue;
    walkNutrition(v, bag, here || classifyKey(k).per100, k);
  }
}

function nutritionFromText(raw: string): MacroBag | null {
  if (!raw) return null;
  const per100 = /每\s*100\s*[gG克]|per\s*100\s*g/i.test(raw);
  const grab = (re: RegExp) => {
    const m = raw.match(re);
    return m ? parseAmount(`${m[1]}${m[2] || ""}`) : null;
  };
  const energy = grab(/(?:能量|热量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(kJ|kj|千焦|kcal|千卡|大卡|卡)?/i);
  const protein = grab(/(?:蛋白质|蛋白)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(g|克)?/i);
  const fat = grab(/脂肪\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(g|克)?/i);
  const carbs = grab(/(?:碳水化合物|碳水)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(g|克)?/i);
  if (!energy && !protein && !fat && !carbs) return null;
  const bag = emptyBag();
  if (energy) takeMacro(bag, "kcal", energy, "能量", per100);
  if (protein) takeMacro(bag, "p", protein, "蛋白", per100);
  if (carbs) takeMacro(bag, "c", carbs, "碳水", per100);
  if (fat) takeMacro(bag, "f", fat, "脂肪", per100);
  bag.per100 = per100;
  return bag;
}

function closeEnough(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(a - b) <= 0.2 || Math.abs(a - b) / b <= 0.02;
}

function finishMacros(bag: MacroBag, grams: number): { kcal: number; protein: number; carbs: number; fat: number; grams: number; per100: boolean } {
  let kcal = bag.kcal;
  if (!(kcal > 0) && (bag.protein > 0 || bag.carbs > 0 || bag.fat > 0)) kcal = bag.protein * 4 + bag.carbs * 4 + bag.fat * 9;
  return { kcal, protein: bag.protein, carbs: bag.carbs, fat: bag.fat, grams, per100: bag.per100 };
}

function readGrams(x: Record<string, unknown>): number {
  for (const k of ["grams", "g", "克", "克数", "重量", "份量", "ml", "毫升"]) {
    if (x[k] == null || x[k] === "") continue;
    const a = parseAmount(x[k]);
    if (a && a.value > 0) return a.value;
  }
  return 0;
}

function asItem(x: Record<string, unknown>, source: PendingFood["source"], raw = ""): PendingFood | null {
  const name = String(x.name ?? x.食物 ?? x.名称 ?? "").trim().slice(0, 40);
  if (!name) return null;
  const mealRaw = String(x.meal ?? x.餐 ?? x.餐次 ?? "");
  const grams = readGrams(x) || 100;
  const bag = emptyBag();
  walkNutrition(x, bag);
  const fromText = nutritionFromText(raw);
  if (!bag.found && fromText) {
    bag.kcal = fromText.kcal; bag.protein = fromText.protein; bag.carbs = fromText.carbs; bag.fat = fromText.fat; bag.per100 = fromText.per100; bag.found = true;
  } else if (bag.found && fromText?.per100 && (closeEnough(bag.protein, fromText.protein) || closeEnough(bag.kcal, fromText.kcal) || closeEnough(bag.fat, fromText.fat))) {
    bag.per100 = true;
  }
  const done = finishMacros(bag, grams);
  const missing = !(done.kcal > 0) && !(done.protein > 0) && !(done.carbs > 0) && !(done.fat > 0);
  const meal = MEAL_SET.has(mealRaw) ? mealRaw : undefined;
  if (done.per100 && grams > 0) {
    return scalePending(withBase({ id: newPendingId(), name, grams: 100, kcal: done.kcal, protein: done.protein, carbs: done.carbs, fat: done.fat, meal, source, missing, baseGrams: 100, baseKcal: done.kcal, baseProtein: done.protein, baseCarbs: done.carbs, baseFat: done.fat }), grams);
  }
  return withBase({ id: newPendingId(), name, grams, kcal: done.kcal, protein: done.protein, carbs: done.carbs, fat: done.fat, meal, source, missing });
}

export function portionsFromText(text: string): { name?: string; grams: number }[] {
  const t = text.trim();
  if (!t) return [];
  const bare = t.match(/^(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)?$/i);
  if (bare) return [{ grams: parseFloat(bare[1]) }];
  const found: { name?: string; grams: number; at: number }[] = [];
  const clean = (s: string) => s.replace(/.*(?:改成|改为|换成|吃了|吃的|来了|再加|加上)/, "").replace(/^[和与、,，\s]+/, "").replace(/^[两俩二三四五六七八九十半几]+个/, "").replace(/[的了]+$/g, "").trim();
  const push = (name: string | undefined, grams: string, at: number) => {
    const g = parseFloat(grams);
    if (!(g > 0) || g > 5000) return;
    if (found.some((f) => Math.abs(f.at - at) < 4 && Math.abs(f.grams - g) < 0.01)) return;
    const n = name ? clean(name) : "";
    found.push({ name: n || undefined, grams: g, at });
  };
  for (const m of t.matchAll(/([\u4e00-\u9fffA-Za-z]{1,20})\s*(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)/gi)) push(m[1], m[2], m.index ?? 0);
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)\s*([\u4e00-\u9fffA-Za-z]{1,20})/gi)) { if (!/^[和与、,，]/.test(m[3])) push(m[3], m[1], m.index ?? 0); }
  for (const m of t.matchAll(/([\u4e00-\u9fff]{2,20})\s*(\d+(?:\.\d+)?)(?!\d)/g)) push(m[1], m[2], m.index ?? 0);
  return found.map(({ name, grams }) => ({ name, grams }));
}

function hydrateMissing(p: PendingFood, raw: string): PendingFood {
  const from = nutritionFromText(raw);
  if (!from?.found) return p;
  const done = finishMacros(from, p.grams || 100);
  if (!(done.kcal > 0) && !(done.protein > 0) && !(done.carbs > 0) && !(done.fat > 0)) return p;
  const baseG = done.per100 ? 100 : (p.grams || 100);
  const item = withBase({ ...p, grams: baseG, kcal: done.kcal, protein: done.protein, carbs: done.carbs, fat: done.fat, missing: false, baseGrams: baseG, baseKcal: done.kcal, baseProtein: done.protein, baseCarbs: done.carbs, baseFat: done.fat });
  return done.per100 && p.grams > 0 && Math.abs(p.grams - baseG) > 0.01 ? scalePending(item, p.grams) : item;
}

function asksForGrams(reply: string): boolean {
  return /请输入.{0,40}克|多少克|几克|克数是多少|克数呢/.test(reply);
}

function applyPortions(pending: PendingFood[], userText: string, reply: string): { pending: PendingFood[]; applied: boolean } {
  const parts = portionsFromText(userText);
  if (!parts.length) return { pending, applied: false };
  const next = [...pending];
  let applied = false;
  const asked = reply.match(/请输入\s*(.+?)\s*的?\s*克/);
  for (const part of parts) {
    let idx = -1;
    if (part.name) idx = next.findIndex((p) => normName(p.name) === normName(part.name || ""));
    if (idx < 0 && !part.name) {
      if (asked?.[1]) idx = next.findIndex((p) => asked[1].includes(p.name) || p.name.includes(asked[1].replace(/的克.*/, "")));
      if (idx < 0 && next.length === 1) idx = 0;
    }
    if (idx < 0 && part.name) {
      next.push(withBase({ id: newPendingId(), name: part.name, grams: part.grams, kcal: 0, protein: 0, carbs: 0, fat: 0, source: "ai", missing: true }));
      applied = true;
      continue;
    }
    if (idx < 0) continue;
    const cur = next[idx];
    applied = true;
    if (Math.abs(cur.grams - part.grams) < 0.01) continue;
    next[idx] = scalePending(withBase(cur), part.grams);
  }
  return { pending: next, applied };
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
  const pending = explicitPending ? (rec.pending == null ? null : pendingRows.map((x) => asItem(x, "ai", raw)).filter((x): x is PendingFood => !!x)) : null;
  const items = (pending ? pendingRows : itemRows).map((x) => asItem(x, "ai", raw)).filter((x): x is PendingFood => !!x);
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
  const gavePortion = portionsFromText(userText).length > 0;
  let parsed: ReturnType<typeof parseModelPayload>;
  try { parsed = parseModelPayload(raw); }
  catch (e) { return { intent: "chat", pending: prev, reply: "", error: e instanceof Error ? e.message : "AI返回内容无法解析", date: null }; }
  if ((local === "question" && !gavePortion) || (parsed.intent === "chat" && !gavePortion)) {
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
  if (!next.length && !incoming.length && !gavePortion) {
    return { intent: parsed.intent || "record", pending: prev, reply: parsed.reply || "没有识别出要记录的食物，待添加没有改。", date: hinted };
  }
  const applied = applyPortions(next.length ? next : prev, userText, parsed.reply);
  next = applied.pending.map((p) => p.missing ? hydrateMissing(p, raw) : p);
  let reply = parsed.reply || `整理了 ${next.length} 样待添加。这是估算，点确认添加才会写入记录。`;
  if (applied.applied && asksForGrams(reply)) {
    reply = `已按你给的份量估算：${next.map((p) => `${p.name} ${r0(p.grams)}g`).join("、")}。这是估算，点确认添加才会写入记录。`;
  }
  return { intent: parsed.intent === "chat" ? "revise" : (parsed.intent || "record"), pending: next, reply, date: hinted };
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
  return items.filter((p) => !p.missing).map((p) => ({
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
