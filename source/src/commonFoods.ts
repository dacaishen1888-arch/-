import { WHEY_SCOOP, type Food } from "./logic";

export const KJ_PER_KCAL = 4.184;

export type LocalHit = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meal?: string;
  missing?: boolean;
};

export type CatalogFood = {
  name: string;
  aliases: string[];
  /** per 100g */
  k: number;
  p: number;
  c: number;
  f: number;
  grams: number;
  portion: string;
  units: Record<string, number>;
  scoop?: { grams: number; k: number; p: number; c: number; f: number };
};

const U = (pairs: [string, number][]): Record<string, number> => Object.fromEntries(pairs);

export const COMMON_FOODS: CatalogFood[] = [
  { name: "米饭(熟)", aliases: ["米饭", "白饭", "大米饭", "熟饭", "饭"], k: 116, p: 2.6, c: 25.9, f: 0.3, grams: 200, portion: "一碗", units: U([["碗", 200], ["拳", 150], ["个", 200]]) },
  { name: "面条(煮熟)", aliases: ["面条", "挂面", "汤面", "面"], k: 110, p: 3.9, c: 22.8, f: 0.4, grams: 250, portion: "一碗", units: U([["碗", 250], ["拳", 150]]) },
  { name: "馒头", aliases: ["馒头", "白馒头"], k: 223, p: 7, c: 47, f: 1.1, grams: 100, portion: "一个", units: U([["个", 100]]) },
  { name: "鸡蛋(整个)", aliases: ["鸡蛋", "蛋", "鸡子"], k: 144, p: 13.3, c: 1.5, f: 8.8, grams: 50, portion: "一个", units: U([["个", 50], ["只", 50]]) },
  { name: "鸡胸肉(熟)", aliases: ["鸡胸肉", "鸡胸", "鸡脯"], k: 165, p: 31, c: 0, f: 3.6, grams: 100, portion: "一掌", units: U([["掌", 100], ["块", 150], ["份", 150]]) },
  { name: "猪里脊(熟)", aliases: ["瘦肉", "里脊", "猪里脊", "猪肉", "肉"], k: 155, p: 27, c: 0, f: 5, grams: 100, portion: "一掌", units: U([["掌", 100], ["份", 100]]) },
  { name: "瘦牛肉(熟)", aliases: ["牛肉", "瘦牛肉", "牛里脊"], k: 180, p: 30, c: 0, f: 6, grams: 100, portion: "一掌", units: U([["掌", 100], ["份", 150]]) },
  { name: "纯牛奶(全脂)", aliases: ["纯牛奶", "牛奶", "鲜奶", "全脂奶", "奶"], k: 65, p: 3.2, c: 4.8, f: 3.6, grams: 250, portion: "一杯", units: U([["杯", 250], ["盒", 250], ["瓶", 250]]) },
  { name: "九牛巴氏鲜奶", aliases: ["九牛巴氏鲜奶", "巴氏鲜奶", "牛奶巴氏", "巴氏奶", "九牛鲜奶", "巴氏杀菌乳"], k: 266 / KJ_PER_KCAL, p: 3, c: 4.4, f: 3.8, grams: 200, portion: "一杯", units: U([["杯", 250], ["盒", 200], ["瓶", 200]]) },
  { name: "希腊酸奶(无糖)", aliases: ["酸奶", "希腊酸奶", "无糖酸奶"], k: 73, p: 10, c: 4, f: 2, grams: 150, portion: "一杯", units: U([["杯", 150], ["盒", 150]]) },
  { name: "乳清蛋白", aliases: ["乳清蛋白", "乳清", "蛋白粉", "whey"], k: 1649 / KJ_PER_KCAL, p: 79, c: 5.8, f: 5.6, grams: 30, portion: "一勺", units: U([["勺", 30]]), scoop: { grams: 30, ...WHEY_SCOOP } },
  { name: "西兰花", aliases: ["西兰花", "绿花菜"], k: 34, p: 2.8, c: 6.6, f: 0.4, grams: 200, portion: "一份", units: U([["份", 200], ["把", 200]]) },
  { name: "苹果", aliases: ["苹果"], k: 52, p: 0.3, c: 13.8, f: 0.2, grams: 200, portion: "一个", units: U([["个", 200]]) },
  { name: "香蕉", aliases: ["香蕉"], k: 89, p: 1.1, c: 22.8, f: 0.3, grams: 120, portion: "一根", units: U([["根", 120], ["个", 120]]) },
  { name: "北豆腐", aliases: ["豆腐", "北豆腐"], k: 98, p: 12.2, c: 1.5, f: 4.8, grams: 150, portion: "一块", units: U([["块", 150], ["份", 150]]) },
  { name: "虾仁", aliases: ["虾仁", "虾"], k: 85, p: 18.6, c: 0, f: 0.8, grams: 100, portion: "一掌", units: U([["掌", 100], ["份", 150]]) },
  { name: "三文鱼", aliases: ["三文鱼", "鲑鱼"], k: 208, p: 20, c: 0, f: 13, grams: 100, portion: "一掌", units: U([["掌", 100], ["块", 150]]) },
  { name: "燕麦片(干)", aliases: ["燕麦片", "燕麦"], k: 377, p: 13.5, c: 66, f: 6.7, grams: 40, portion: "一份", units: U([["份", 40], ["勺", 15]]) },
  { name: "橄榄油", aliases: ["橄榄油", "食用油", "油"], k: 884, p: 0, c: 0, f: 100, grams: 10, portion: "一勺", units: U([["勺", 10]]) },
  { name: "番茄", aliases: ["番茄", "西红柿"], k: 18, p: 0.9, c: 3.9, f: 0.2, grams: 150, portion: "一个", units: U([["个", 150]]) },
  { name: "黄瓜", aliases: ["黄瓜"], k: 16, p: 0.7, c: 3.6, f: 0.1, grams: 200, portion: "一根", units: U([["根", 200], ["个", 200]]) },
  { name: "玉米(煮)", aliases: ["玉米"], k: 112, p: 4, c: 22.8, f: 1.2, grams: 200, portion: "一根", units: U([["根", 200], ["个", 200]]) },
  { name: "红薯(蒸)", aliases: ["红薯", "地瓜"], k: 86, p: 1.6, c: 20, f: 0.1, grams: 200, portion: "一个", units: U([["个", 200]]) },
  { name: "全麦面包", aliases: ["全麦面包", "面包"], k: 246, p: 9.7, c: 41, f: 3.4, grams: 60, portion: "两片", units: U([["片", 30], ["个", 60]]) },
  { name: "豆浆(无糖)", aliases: ["豆浆", "无糖豆浆"], k: 31, p: 3, c: 1.2, f: 1.6, grams: 300, portion: "一杯", units: U([["杯", 300]]) },
];

export const SHORTCUTS: { id: string; label: string; food: string; unit: string }[] = [
  { id: "bowl-rice", label: "一碗饭", food: "米饭(熟)", unit: "碗" },
  { id: "fist-rice", label: "一拳饭", food: "米饭(熟)", unit: "拳" },
  { id: "palm-meat", label: "一掌肉", food: "猪里脊(熟)", unit: "掌" },
  { id: "one-egg", label: "一个蛋", food: "鸡蛋(整个)", unit: "个" },
  { id: "cup-milk", label: "一杯奶", food: "纯牛奶(全脂)", unit: "杯" },
  { id: "scoop-whey", label: "一勺乳清", food: "乳清蛋白", unit: "勺" },
  { id: "spoon-oil", label: "一勺油", food: "橄榄油", unit: "勺" },
  { id: "veg", label: "一份菜", food: "西兰花", unit: "份" },
];

const ALIAS: Record<string, string> = { "甜品": "甜点", "点心": "糕点", "零嘴": "零食", "快餐": "外卖", "西红柿": "番茄", "宫爆": "宫保", "削面": "刀削面" };
const STOP = new Set(["你好", "谢谢", "好的", "嗯嗯", "可以", "不是", "知道", "收到", "在吗", "哈喽", "谢谢你", "没事", "好呀", "行吧"]);
const CN_NUM: Record<string, number> = { 半: 0.5, 一: 1, 二: 2, 两: 2, 俩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const UNIT_RE = "碗|掌|拳|勺|匙|杯|个|只|根|片|块|份|把|盒|袋|瓶";

export type Utterance = {
  kind: "question" | "clear" | "remove" | "revise" | "add" | "record" | "grams" | "none";
  foods: LocalHit[];
  names: string[];
  grams?: number;
  target?: string;
};

function normText(s: string): string {
  return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, " ").trim();
}

function fixTypos(s: string): string {
  return s
    .replace(/鸡旦/g, "鸡蛋")
    .replace(/鸡子/g, "鸡蛋")
    .replace(/米反/g, "米饭")
    .replace(/白反/g, "白饭")
    .replace(/牛乃/g, "牛奶")
    .replace(/鲜乃/g, "鲜奶")
    .replace(/鸡胸内/g, "鸡胸肉")
    .replace(/蛋白份/g, "蛋白粉")
    .replace(/乳清旦白/g, "乳清蛋白")
    .replace(/西蓝花/g, "西兰花")
    .replace(/西红试/g, "西红柿")
    .replace(/宫爆/g, "宫保");
}

function edit1(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

export function normFoodKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "").replace(/[()（）]/g, "");
}

export function matchFood(token: string): CatalogFood | null {
  const t = normFoodKey(fixTypos(token));
  if (!t || STOP.has(t)) return null;
  let best: { food: CatalogFood; score: number; len: number } | null = null;
  const consider = (food: CatalogFood, score: number, len: number) => {
    if (!best || score > best.score || (score === best.score && len > best.len)) best = { food, score, len };
  };
  for (const food of COMMON_FOODS) {
    for (const alias of food.aliases) {
      const a = normFoodKey(alias);
      if (!a) continue;
      if (t === a) consider(food, 100, a.length);
      else if (a.length >= 2 && t.includes(a)) consider(food, 80, a.length);
      else if (t.length >= 2 && a.includes(t) && t.length >= a.length - 1) consider(food, 60, t.length);
    }
  }
  if (best && best.score >= 60) return best.food;
  for (const food of COMMON_FOODS) {
    for (const alias of food.aliases) {
      const a = normFoodKey(alias);
      if (t.length >= 3 && edit1(t, a)) consider(food, 55, a.length);
    }
  }
  return best && best.score >= 55 ? best.food : null;
}

export function foodsMatch(a: string, b: string): boolean {
  const na = normFoodKey(a);
  const nb = normFoodKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;
  if (short.length >= 2 && long.includes(short)) return true;
  const fa = matchFood(a);
  const fb = matchFood(b);
  return !!fa && fa.name === fb?.name;
}

function scaleFood(food: CatalogFood, grams: number): LocalHit {
  const m = grams / 100;
  return { name: food.name, grams, kcal: food.k * m, protein: food.p * m, carbs: food.c * m, fat: food.f * m };
}

function fromScoop(food: CatalogFood, count: number): LocalHit {
  const s = food.scoop!;
  return { name: food.name, grams: s.grams * count, kcal: s.k * count, protein: s.p * count, carbs: s.c * count, fat: s.f * count };
}

function realize(food: CatalogFood, explicit: number | null, unit: string | null, count: number): LocalHit {
  const n = count > 0 ? count : 1;
  if (food.scoop && unit === "勺") return fromScoop(food, n);
  if (food.scoop && explicit == null && !unit) return fromScoop(food, n);
  if (explicit != null && explicit > 0) return scaleFood(food, explicit);
  if (unit && food.units[unit]) return scaleFood(food, food.units[unit] * n);
  return scaleFood(food, food.grams * n);
}

function libScore(food: Food, token: string): number {
  const q = normFoodKey(token);
  if (q.length < 2) return 0;
  const n = normFoodKey(food.n);
  const bare = normFoodKey(food.n.replace(/[（(].*?[）)]/g, ""));
  const tags = (food.t || "").toLowerCase();
  const aliased = Object.keys(ALIAS).reduce((s, k) => (s.includes(k) ? s.replace(k, ALIAS[k]) : s), token);
  const qa = normFoodKey(aliased);
  if (n === q || bare === q || n === qa || bare === qa) return 100;
  if ((bare.startsWith(q) || bare.startsWith(qa)) && q.length >= 2) return 84;
  if (q.length >= 2 && (bare.includes(q) || n.includes(q) || bare.includes(qa))) return 72;
  if (q.length >= 2 && (tags.includes(q) || tags.includes(qa))) return 48;
  if ((q.length >= 3 && edit1(q, bare)) || (qa.length >= 3 && edit1(qa, bare))) return 56;
  return 0;
}

function libraryHit(token: string, explicit: number | null, unit: string | null, count: number, library: readonly Food[]): LocalHit | null {
  let best: { food: Food; score: number } | null = null;
  for (const food of library) {
    const score = libScore(food, token);
    if (!best || score > best.score) best = { food, score };
  }
  if (!best || best.score < 56) return null;
  const food = best.food;
  const n = count > 0 ? count : 1;
  if (food.su === "勺" && /乳清|whey/i.test(food.n)) {
    const scoops = unit === "勺" || explicit == null ? n : explicit / 30;
    return { name: "乳清蛋白", grams: 30 * scoops, kcal: WHEY_SCOOP.k * scoops, protein: WHEY_SCOOP.p * scoops, carbs: WHEY_SCOOP.c * scoops, fat: WHEY_SCOOP.f * scoops };
  }
  let grams = explicit;
  if (grams == null) {
    if (unit && food.u.includes(unit)) grams = food.g * n;
    else if (unit === "掌") grams = 100 * n;
    else if (unit === "拳") grams = 150 * n;
    else if (unit === "勺") grams = 15 * n;
    else if (unit === "杯") grams = food.g * n;
    else grams = food.g * n;
  }
  if (food.su) {
    const servings = explicit != null ? explicit : n;
    return { name: food.n, grams: food.g * servings, kcal: food.k * servings, protein: food.p * servings, carbs: food.c * servings, fat: food.f * servings };
  }
  const m = grams / 100;
  return { name: food.n, grams, kcal: food.k * m, protein: food.p * m, carbs: food.c * m, fat: food.f * m };
}

function cnCount(s: string): number {
  if (CN_NUM[s] != null) return CN_NUM[s];
  const n = parseFloat(s);
  return isFinite(n) ? n : 1;
}

function stripNoise(s: string): string {
  let t = s.trim();
  const lead = /^(今天|刚才|我|想|要|帮我|请|记一下|记录一下|记录|吃了|吃的|来了|来份|来点|加了|早餐|午餐|晚餐|加餐|训练后|的|了)+/;
  while (lead.test(t)) t = t.replace(lead, "").trim();
  return t.replace(/[的了啊呀吧呢]+$/g, "").trim();
}

function parseExplicitGrams(seg: string): { grams: number; rest: string } | null {
  const m = seg.match(/(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)\b/i) || seg.match(/(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)/i);
  if (!m || m.index == null) return null;
  const grams = parseFloat(m[1]);
  if (!(grams > 0) || grams > 5000) return null;
  const rest = stripNoise(`${seg.slice(0, m.index)} ${seg.slice(m.index + m[0].length)}`);
  return { grams, rest };
}

function parseUnit(seg: string): { count: number; unit: string; rest: string } | null {
  const m = seg.match(new RegExp(`(半|[一二两俩三四五六七八九十]|\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})(半)?`));
  if (!m || m.index == null) return null;
  let count = cnCount(m[1]);
  if (m[3]) count += 0.5;
  const unit = m[2] === "匙" ? "勺" : m[2];
  const rest = stripNoise(`${seg.slice(0, m.index)} ${seg.slice(m.index + m[0].length)}`);
  return { count, unit, rest };
}

function cleanName(s: string): string {
  return stripNoise(s).replace(/^[和与跟、,，\s]+/, "").replace(/[和与跟、,，\s]+$/g, "").slice(0, 40).trim();
}

function hitForToken(token: string, explicit: number | null, unit: string | null, count: number, library: readonly Food[] | undefined, meal?: string): LocalHit | null {
  let name = cleanName(token);
  if (name === "菜" || name === "青菜" || name === "蔬菜") name = "西兰花";
  if (!name && unit) {
    if (unit === "碗" || unit === "拳") name = "饭";
    else if (unit === "掌") name = "肉";
    else if (unit === "杯") name = "奶";
    else if (unit === "个") name = "蛋";
    else if (unit === "份") name = "西兰花";
    else if (unit === "勺") name = token.includes("油") ? "油" : token.includes("乳") || token.includes("蛋白") ? "乳清" : "";
  }
  if (!name) return null;
  const catalog = matchFood(name);
  if (catalog) {
    const hit = realize(catalog, explicit, unit, count);
    return meal ? { ...hit, meal } : hit;
  }
  if (library?.length) {
    const hit = libraryHit(name, explicit, unit, count, library);
    if (hit) return meal ? { ...hit, meal } : hit;
  }
  const grams = explicit ?? (unit === "掌" ? 100 : unit === "碗" ? 200 : unit === "拳" ? 150 : unit === "杯" ? 250 : unit === "勺" ? 15 : unit === "个" ? 100 : 100) * (explicit ? 1 : (count || 1));
  if (STOP.has(name) || name.length < 2) return null;
  return { name, grams, kcal: 0, protein: 0, carbs: 0, fat: 0, meal, missing: true };
}

function foodsIn(text: string, library: readonly Food[] | undefined, meal?: string, allowUnknown = false): LocalHit[] {
  const parts = text.split(/[、,，;；+\n]|(?:和|与|跟|以及|还有)/).map((s) => s.trim()).filter(Boolean);
  const out: LocalHit[] = [];
  for (const part of parts) {
    const seg = stripNoise(part);
    if (!seg) continue;
    const grams = parseExplicitGrams(seg);
    const unit = parseUnit(grams?.rest || (grams ? "" : seg));
    const explicit = grams?.grams ?? null;
    const token = cleanName(grams?.rest || unit?.rest || (grams || unit ? "" : seg));
    if (!token && !unit) continue;
    const hit = hitForToken(token, explicit, unit?.unit || null, unit?.count || 1, library, meal);
    if (!hit) continue;
    if (hit.missing && !allowUnknown && explicit == null && !unit) continue;
    out.push(hit);
  }
  return out;
}

function mealChunks(text: string): { meal?: string; text: string }[] {
  const re = /(早餐|训练后|午餐|晚餐|加餐)/g;
  const found = [...text.matchAll(re)];
  if (!found.length) return [{ text }];
  const chunks: { meal?: string; text: string }[] = [];
  if ((found[0].index || 0) > 0) chunks.push({ text: text.slice(0, found[0].index) });
  found.forEach((m, i) => {
    const start = (m.index || 0) + m[0].length;
    const end = found[i + 1]?.index ?? text.length;
    chunks.push({ meal: m[0], text: text.slice(start, end) });
  });
  return chunks.filter((c) => c.text.trim());
}

export function parseUtterance(input: string, library?: readonly Food[]): Utterance {
  const text = fixTypos(normText(input));
  const empty = (kind: Utterance["kind"]): Utterance => ({ kind, foods: [], names: [] });
  if (!text) return empty("none");
  if (/清空|都不要了|不用记了|取消这些/.test(text)) return empty("clear");
  const bare = text.match(/^(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)?$/i);
  if (bare) return { kind: "grams", foods: [], names: [], grams: parseFloat(bare[1]) };
  const question = /[?？]|吗|多少|为什么|怎么样|如何|热量高|够不够|什么是|区别|可以吃吗/.test(text);
  const explicit = /吃了|记一下|记录|再加|加上|还要|改成|改为|换成/.test(text);
  if (question && !explicit) return empty("question");
  const removed = text.match(/(?:去掉|删掉|不要了?)(.+)/);
  if (removed && !/改成|改为|换成/.test(text)) {
    const foods = foodsIn(removed[1], library);
    const names = foods.map((f) => f.name);
    const rawNames = removed[1].split(/[、,，和与跟]/).map(cleanName).filter((n) => n.length >= 2);
    return { kind: "remove", foods, names: names.length ? names : rawNames };
  }
  const revised = text.match(/(.+?)(?:改成|改为|换成)(.+)/);
  if (revised) {
    const grams = parseExplicitGrams(revised[2]);
    const foods = foodsIn(revised[2], library);
    return { kind: "revise", foods, names: [cleanName(revised[1])].filter(Boolean), grams: grams?.grams, target: cleanName(revised[1]) };
  }
  const allowUnknown = /吃了|记一下|记录|再加|加上|还要/.test(text);
  const foods = mealChunks(text).flatMap((c) => foodsIn(c.text, library, c.meal, allowUnknown));
  if (!foods.length) return empty("none");
  const kind = /^(再加|加上|还要|再来)/.test(text) ? "add" : "record";
  return { kind, foods, names: foods.map((f) => f.name) };
}

export function hitFromShortcut(id: string): LocalHit | null {
  const s = SHORTCUTS.find((x) => x.id === id);
  const food = s && COMMON_FOODS.find((f) => f.name === s.food);
  if (!s || !food) return null;
  return realize(food, null, s.unit, 1);
}

export function estimateKnown(name: string, grams: number, library?: readonly Food[]): LocalHit | null {
  const food = matchFood(name);
  if (food) {
    if (food.scoop && (!grams || Math.abs(grams - food.scoop.grams) < 0.01)) return fromScoop(food, 1);
    return scaleFood(food, grams > 0 ? grams : food.grams);
  }
  if (!library?.length) return null;
  return libraryHit(name, grams > 0 ? grams : null, null, 1, library);
}

export type LabelRead = {
  readable: boolean;
  name: string;
  per100: boolean;
  basisGrams: number;
  servingGrams: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sodiumMg: number | null;
  barcode: string | null;
  energyUnit: "kJ" | "kcal" | null;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) && v >= 0 ? v : null;
  const m = String(v).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isFinite(n) && n >= 0 ? n : null;
}

function energyToKcal(value: number, unit: string): { kcal: number; energyUnit: "kJ" | "kcal" } {
  if (/kj|千焦/i.test(unit) && !/kcal|千卡|大卡/.test(unit)) return { kcal: value / KJ_PER_KCAL, energyUnit: "kJ" };
  return { kcal: value, energyUnit: "kcal" };
}

function looseJson(raw: string): Record<string, unknown> | null {
  let s = raw.replace(/```(?:json)?/gi, "").replace(/[“”]/g, "\"").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  s = s.slice(a, b + 1).replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(s) as Record<string, unknown>; }
  catch { /* repair keys */ }
  try { return JSON.parse(s.replace(/([{,]\s*)([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*:/g, "$1\"$2\":")) as Record<string, unknown>; }
  catch { return null; }
}

function readLabelRegex(raw: string): Partial<LabelRead> {
  const masked = raw.replace(/饱和脂肪[\s\S]{0,12}?\d+(?:\.\d+)?\s*(?:g|克)?/gi, " ").replace(/反式脂肪[\s\S]{0,12}?\d+(?:\.\d+)?\s*(?:g|克)?/gi, " ");
  const per100 = /每\s*100\s*(?:g|克|ml|毫升)|每\s*100\s*克含量|per\s*100\s*g/i.test(masked);
  const energy = masked.match(/(?:能量|热量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(kJ|kj|千焦|千焦耳|kcal|千卡|大卡|卡路里)?/i);
  const protein = masked.match(/(?:蛋白质|蛋白)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:g|克)?/i);
  const fat = masked.match(/(?<!饱和)(?<!反式)脂肪\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:g|克)?/i);
  const carbs = masked.match(/(?:碳水化合物|碳水)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:g|克)?/i);
  const sodium = masked.match(/钠\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:mg|毫克)?/i);
  const serving = masked.match(/(?:每份|食用份量|单份|每勺|一勺)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:g|克|ml|毫升)/i);
  const barcode = masked.match(/(?:条形码|条码|barcode)?\s*[:：]?\s*(69\d{11})/i) || masked.match(/(?<!\d)(\d{13})(?!\d)/);
  let kcal: number | null = null;
  let energyUnit: "kJ" | "kcal" | null = null;
  if (energy) {
    const conv = energyToKcal(parseFloat(energy[1]), energy[2] || "");
    if (energy[2] || conv.kcal > 0) {
      kcal = conv.kcal;
      energyUnit = energy[2] ? conv.energyUnit : null;
      if (!energy[2]) kcal = parseFloat(energy[1]);
    }
  }
  return {
    per100,
    basisGrams: per100 ? 100 : 100,
    servingGrams: serving ? parseFloat(serving[1]) : null,
    kcal,
    protein: protein ? parseFloat(protein[1]) : null,
    fat: fat ? parseFloat(fat[1]) : null,
    carbs: carbs ? parseFloat(carbs[1]) : null,
    sodiumMg: sodium ? parseFloat(sodium[1]) : null,
    barcode: barcode ? barcode[1] : null,
    energyUnit,
  };
}

function guessName(raw: string, protein: number | null, carbs: number | null, fat: number | null): string {
  const jsonName = raw.match(/(?:品名|产品名称|名称)\s*[:：]\s*([^\n,，]{2,30})/);
  if (jsonName && !/营养成分|含量|项目/.test(jsonName[1])) return jsonName[1].trim();
  let best = "";
  for (const food of COMMON_FOODS) {
    for (const alias of food.aliases) {
      if (alias.length >= 3 && raw.includes(alias) && alias.length > best.length) best = food.name === "乳清蛋白" ? "乳清蛋白" : alias.length >= food.name.length ? food.name : alias;
    }
  }
  if (best) return best;
  if ((protein || 0) >= 70 && (fat || 0) < 20 && (carbs || 0) < 20) return "蛋白粉";
  return "";
}

export function parseLabelText(raw: string): LabelRead {
  const text = String(raw || "");
  const json = looseJson(text);
  const regex = readLabelRegex(text);
  let kcal = regex.kcal ?? null;
  let protein = regex.protein ?? null;
  let fat = regex.fat ?? null;
  let carbs = regex.carbs ?? null;
  let energyUnit = regex.energyUnit ?? null;
  let servingGrams = regex.servingGrams ?? null;
  let barcode = regex.barcode ?? null;
  let name = "";
  let per100 = !!regex.per100;
  if (json) {
    const basis = String(json.basis || json.per || "");
    if (/100/.test(basis) || json.per100 === true) per100 = true;
    const unit = String(json.energyUnit || json.unit || "");
    const energy = numOrNull(json.energy ?? json.kcal ?? json.能量);
    if (energy != null && (unit || json.energy != null || json.能量 != null)) {
      const conv = energyToKcal(energy, unit || (energy > 0 && /kj|千焦/i.test(JSON.stringify(json.energy ?? json.能量 ?? "")) ? "kJ" : "kcal"));
      kcal = conv.kcal;
      energyUnit = unit ? conv.energyUnit : energyUnit;
    }
    protein = numOrNull(json.protein ?? json.蛋白质) ?? protein;
    fat = numOrNull(json.fat ?? json.脂肪) ?? fat;
    carbs = numOrNull(json.carbs ?? json.碳水化合物 ?? json.碳水) ?? carbs;
    servingGrams = numOrNull(json.servingGrams ?? json.每份 ?? json.份量) ?? servingGrams;
    const code = String(json.barcode || json.条码 || "").replace(/\D/g, "");
    if (code.length >= 8) barcode = code;
    const jName = String(json.name || json.名称 || "").trim();
    if (jName && !/营养成分|含量/.test(jName)) name = jName.slice(0, 40);
  }
  if (!name) name = guessName(text, protein, carbs, fat);
  const explicitZero = /(?:能量|热量)\s*[:：]?\s*0(?:\.0+)?\s*(?:kJ|kj|千焦|kcal|千卡|大卡)/i.test(text);
  if ((kcal == null || kcal === 0) && !explicitZero && ((protein || 0) > 0 || (fat || 0) > 0 || (carbs || 0) > 0)) {
    kcal = (protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9;
    if (!energyUnit) energyUnit = "kcal";
  }
  const any = (kcal != null && kcal > 0) || (protein != null && protein > 0) || (fat != null && fat > 0) || (carbs != null && carbs > 0) || explicitZero;
  const perBasis = per100 || !servingGrams;
  return {
    readable: any,
    name,
    per100: perBasis,
    basisGrams: perBasis ? 100 : servingGrams || 100,
    servingGrams,
    kcal: any ? kcal : null,
    protein, fat, carbs,
    sodiumMg: regex.sodiumMg ?? null,
    barcode,
    energyUnit,
  };
}

export function userPortionGrams(text: string): number | null {
  if (looksLikeLabel(text)) {
    const lines = text.split(/\n|。/).map((s) => s.trim()).filter(Boolean);
    for (const line of lines) {
      if (/能量|蛋白|脂肪|碳水|钠|钙|糖|每\s*100/.test(line)) continue;
      const m = line.match(/(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)/i);
      if (m) return parseFloat(m[1]);
    }
    return null;
  }
  const u = parseUtterance(text);
  if (u.kind === "grams" && u.grams) return u.grams;
  if ((u.kind === "record" || u.kind === "add" || u.kind === "revise") && u.foods.length === 1 && u.foods[0].grams > 0 && !u.foods[0].missing) return u.foods[0].grams;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)/i);
  if (m) return parseFloat(m[1]);
  return null;
}

export function looksLikeLabel(text: string): boolean {
  return /营养成分|能量|热量/.test(text) && /蛋白|脂肪|碳水/.test(text) && /\d/.test(text);
}

export type LabelPending = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  missing: boolean;
  reply: string;
  barcode: string | null;
};

export function pendingFromLabel(source: string, userText = ""): LabelPending {
  const label = parseLabelText(source);
  const userGrams = userPortionGrams(userText);
  const uttered = userText && !looksLikeLabel(userText) ? parseUtterance(userText) : null;
  const hintedName = uttered && uttered.foods.length === 1 ? uttered.foods[0].name : "";
  const name = label.name || hintedName || "包装食品";
  const basis = label.basisGrams || 100;
  if (!label.readable || label.kcal == null) {
    const grams = userGrams || label.servingGrams || basis;
    return { name, grams, kcal: 0, protein: 0, carbs: 0, fat: 0, missing: true, barcode: label.barcode, reply: "营养未识别，请补充。没有按 0 千卡记入。" };
  }
  const grams = userGrams || label.servingGrams || basis;
  const m = grams / basis;
  const kcal = label.kcal * m;
  const protein = (label.protein || 0) * m;
  const carbs = (label.carbs || 0) * m;
  const fat = (label.fat || 0) * m;
  const unitNote = label.energyUnit === "kJ" ? "标签千焦已÷4.184。" : "";
  const gramNote = userGrams ? `按你给的 ${userGrams}g 换算，不用再填克数。` : label.servingGrams ? `按标签份量 ${label.servingGrams}g。` : `先按 ${grams}g，可改克数。`;
  const sodium = label.sodiumMg != null ? `钠约 ${Math.round(label.sodiumMg * m)}mg，不计入热量。` : "";
  const reply = `${name} 每${basis}g 约 ${Math.round(label.kcal)} kcal。${unitNote}${gramNote}${sodium}点确认添加才会写入记录。`;
  return { name, grams, kcal, protein, carbs, fat, missing: false, barcode: label.barcode, reply };
}

const BAR_KEY = "ct_barcodes_v47";

export const SEED_BARCODES: Record<string, { n: string; k: number; p: number; c: number; f: number }> = {
  "6959909102831": { n: "九牛巴氏鲜奶", k: 266 / KJ_PER_KCAL, p: 3, c: 4.4, f: 3.8 },
};

export type BarHit = { n: string; k: number; p: number; c: number; f: number };

export function recallBarcode(code: string): BarHit | null {
  const cc = code.replace(/\D/g, "");
  if (!cc) return null;
  try {
    const mem = JSON.parse(localStorage.getItem(BAR_KEY) || "{}") as Record<string, BarHit>;
    if (mem[cc] && ((mem[cc].k > 0) || mem[cc].p > 0 || mem[cc].c > 0 || mem[cc].f > 0)) return mem[cc];
  } catch { /* ignore */ }
  return SEED_BARCODES[cc] || null;
}

export function rememberBarcode(code: string, food: BarHit): void {
  const cc = code.replace(/\D/g, "");
  if (cc.length < 8) return;
  if (!(food.k > 0) && !(food.p > 0) && !(food.c > 0) && !(food.f > 0)) return;
  try {
    const mem = JSON.parse(localStorage.getItem(BAR_KEY) || "{}") as Record<string, BarHit>;
    mem[cc] = food;
    localStorage.setItem(BAR_KEY, JSON.stringify(mem));
  } catch { /* ignore */ }
}

export function offToFood(j: { status?: number; product?: { product_name?: string; product_name_zh?: string; brands?: string; nutriments?: Record<string, unknown> } } | null): BarHit | null {
  if (!j || j.status !== 1 || !j.product) return null;
  const nu = j.product.nutriments || {};
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return isFinite(n) ? n : 0;
  };
  let kcal = num(nu["energy-kcal_100g"]);
  if (!(kcal > 0)) {
    const kj = num(nu["energy-kj_100g"]) || num(nu["energy_100g"]);
    if (kj > 0) kcal = kj / KJ_PER_KCAL;
  }
  const protein = num(nu.proteins_100g);
  const carbs = num(nu.carbohydrates_100g);
  const fat = num(nu.fat_100g);
  if (!(kcal > 0) && !(protein > 0) && !(carbs > 0) && !(fat > 0)) return null;
  if (!(kcal > 0)) kcal = protein * 4 + carbs * 4 + fat * 9;
  const name = String(j.product.product_name_zh || j.product.product_name || "").trim();
  if (!name) return null;
  const brand = j.product.brands ? `（${String(j.product.brands).split(",")[0].slice(0, 20)}）` : "";
  return { n: `${name}${brand}`.slice(0, 40), k: kcal, p: +protein.toFixed(1), c: +carbs.toFixed(1), f: +fat.toFixed(1) };
}
