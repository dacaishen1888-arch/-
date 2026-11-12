export type Food = { n: string; k: number; p: number; c: number; f: number; g: number; u: string; t?: string; su?: string; mine?: boolean };
export type Entry = { id: number; meal: string; name: string; grams: number; k: number; p: number; c: number; f: number; qty?: number };
export type Profile = {
  h: string; w: string; age: string; bf: string; act: string; def: string; wt?: string;
  bmr?: string;
  tk?: string; tp?: string; tc?: string; tf?: string;
  rk?: string; rp?: string; rc?: string; rf?: string;
  pLo?: string; pHi?: string;
  tcLo?: string; tcHi?: string; rcLo?: string; rcHi?: string;
};
export const PROFILE_DEFAULT: Profile = { h: "170", w: "80.1", age: "34", bf: "17.7", bmr: "1795", act: "1.6", def: "18" };
export type Body = { date: string; w: number; waist: number };
export type Macros = { k: number; p: number; c: number; f: number };

export const MEALS = ["早餐", "训练后", "午餐", "晚餐", "加餐"] as const;

export function suggestMeal(hour: number): (typeof MEALS)[number] {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 10) return "早餐";
  if (h >= 10 && h < 12) return "训练后";
  if (h >= 12 && h < 15) return "午餐";
  if (h >= 15 && h < 18) return "加餐";
  return "晚餐";
}

export function r0(x: number): number { return Math.round(x); }

export function formatShanghai(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

export function shanghaiToday(now = new Date()): string { return formatShanghai(now); }

export function addDays(iso: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  const z = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`;
}

export function dayDiff(from: string, to: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 864e5);
}

export function weekday(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return 0;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

export function isTrain(iso: string): boolean {
  const w = weekday(iso);
  return w >= 1 && w <= 5;
}

export function lastNDays(end: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

function opt(v: string | undefined, fallback: number): number {
  if (v == null || String(v).trim() === "") return fallback;
  const n = parseFloat(v);
  return isFinite(n) && n >= 0 ? r0(n) : fallback;
}

export function bmrOf(pr: Profile): { bmr: number; source: "measured" | "katch" | "mifflin"; lbm: number } {
  const h = parseFloat(pr.h) || 170, w = parseFloat(pr.w) || 80.1, a = parseFloat(pr.age) || 34, bf = parseFloat(pr.bf);
  const lbm = bf > 3 && bf < 60 ? w * (1 - bf / 100) : w;
  const measured = parseFloat(pr.bmr || "");
  if (measured > 500 && measured < 5000) return { bmr: measured, source: "measured", lbm };
  if (bf > 3 && bf < 60) return { bmr: 370 + 21.6 * lbm, source: "katch", lbm };
  return { bmr: 10 * w + 6.25 * h - 5 * a + 5, source: "mifflin", lbm };
}

export function calcTargets(pr: Profile, train: boolean) {
  const w = parseFloat(pr.w) || 80.1;
  const { bmr, source, lbm } = bmrOf(pr);
  const base = parseFloat(pr.act) || 1.55;
  const mult = train ? base : Math.max(1.2, base - 0.3);
  let pMin = opt(pr.pLo, 160);
  let pMax = opt(pr.pHi, 175);
  if (pMax < pMin) { const swap = pMin; pMin = pMax; pMax = swap; }
  const pRef = 174;
  const c0 = r0(w * (train ? 3 : 1.5));
  const f0 = r0(w * (train ? 0.637 : 0.762));
  let cMin = opt(train ? pr.tcLo : pr.rcLo, train ? 220 : 100);
  let cMax = opt(train ? pr.tcHi : pr.rcHi, train ? 240 : 120);
  if (cMax < cMin) { const swap = cMin; cMin = cMax; cMax = swap; }
  const cRef = opt(train ? pr.tc : pr.rc, c0);
  const f = opt(train ? pr.tf : pr.rf, f0);
  const kcal = opt(train ? pr.tk : pr.rk, r0(pRef * 4 + cRef * 4 + f * 9));
  return { bmr: r0(bmr), bmrSource: source, lbm: Math.round(lbm * 10) / 10, tdee: r0(bmr * mult), kcal, p: pMin, pMin, pMax, pRef, c: cMin, cMin, cMax, cRef, f };
}

function storedNum(raw: string | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = parseFloat(String(raw));
  return isFinite(n) ? n : null;
}

export function migrateProteinTargets(pr: Profile): Profile {
  const next: Profile = { ...pr };
  if (storedNum(pr.tf) === 55) next.tf = "51";
  if (storedNum(pr.rf) === 65) next.rf = "61";
  const autoP = (n: number | null) => n === 165 || n === 174;
  const tp = storedNum(pr.tp);
  const rp = storedNum(pr.rp);
  if (autoP(tp)) next.tp = "";
  if (autoP(rp)) next.rp = "";
  const genuine = [tp, rp].filter((n): n is number => n != null && !autoP(n));
  if (genuine.length && storedNum(pr.pLo) == null && storedNum(pr.pHi) == null) {
    next.pLo = String(Math.min(...genuine));
    next.pHi = String(Math.max(...genuine));
    next.tp = "";
    next.rp = "";
  }
  return next;
}

export function weeklyDeficit(pr: Profile): number {
  const b = bmrOf(pr).bmr;
  const act = parseFloat(pr.act) || 1.55;
  const tdeeT = b * act, tdeeR = b * Math.max(1.2, act - 0.3);
  const inn = calcTargets(pr, true).kcal * 5 + calcTargets(pr, false).kcal * 2;
  const out = tdeeT * 5 + tdeeR * 2;
  return r0((out - inn) / 7);
}

export function needsTrainCarb(train: boolean, meal: string, carbs: number): boolean {
  return train && (meal === "早餐" || meal === "训练后") && carbs < 40;
}

export type GapTone = "ok" | "low" | "near" | "over" | "must" | "done";
export type GapLine = { name: string; text: string; chip: string; tone: GapTone; must: boolean; done: boolean };
export type TodayTargets = { kcal: number; p: number; pMin: number; pMax: number; pRef: number; c: number; cMin: number; cMax: number; cRef: number; f: number };

export function isMustReach(name: string, train: boolean): boolean {
  if (name === "蛋白") return true;
  return name === "碳水" && train;
}

function macroPct(v: number, t: number): number { return t > 0 ? Math.round(v / t * 100) : 0; }

function chipOf(text: string): string {
  return text.replace(/^(热量|蛋白|碳水|脂肪)/, "").replace(/\s/g, "").replace(/kcal/g, "");
}

function rangeLine(name: string, value: number, min: number, max: number, floorWord: string): GapLine {
  if (value + 1e-6 < min) {
    const left = Math.max(0, r0(min - value));
    return { name, text: `${name}还差 ${left}g 到${floorWord}`, chip: `还差${left}g`, tone: "must", must: true, done: false };
  }
  if (value > max) {
    const over = Math.max(0, r0(value - max));
    return { name, text: `${name}略超 ${over}g`, chip: `略超${over}g`, tone: "near", must: true, done: true };
  }
  return { name, text: `${name}已吃够`, chip: "已吃够", tone: "done", must: true, done: true };
}

export function proteinBand(min: number, max: number): string {
  return max > min ? `${min}–${max}` : String(min);
}

function gapLine(name: string, unit: string, value: number, target: number, must: boolean): GapLine {
  const left = Math.max(0, r0(target - value));
  const over = Math.max(0, r0(value - target));
  const p = macroPct(value, target);
  const u = unit === "kcal" ? " kcal" : unit;
  const line = (text: string, tone: GapTone, done: boolean): GapLine => ({ name, text, chip: chipOf(text), tone, must, done });
  if (must) {
    if (value + 1e-6 >= target) return line(`${name}已吃够`, "done", true);
    return line(`${name}还差 ${left}${u}`, "must", false);
  }
  if (value > target) return line(`${name}已超 ${over}${u}`, "over", false);
  if (p >= 90) return line(`${name}已到 ${p}%`, "ok", false);
  return line(`${name}还可吃 ${left}${u}`, "ok", false);
}

export function fatLeftLabel(eaten: number, target: number): { text: string; tone: "ok" | "low" | "over"; left: number } {
  const over = r0(eaten - target);
  const left = Math.max(0, r0(target - eaten));
  if (over > 0) return { text: `脂肪已超 ${over}g`, tone: "over", left: 0 };
  return { text: `脂肪还剩 ${left}g`, tone: left < 10 ? "low" : "ok", left };
}

export type HoldState = { phase: "idle" | "pending" | "holding"; open: boolean };
export type HoldEvent = "down" | "hold" | "up" | "cancel" | "outside" | "toggle";

export function holdPress(state: HoldState, event: HoldEvent): HoldState {
  if (event === "down") return { phase: "pending", open: state.open };
  if (event === "hold") return state.phase === "pending" ? { phase: "holding", open: true } : state;
  if (event === "up") {
    if (state.phase === "holding") return { phase: "idle", open: false };
    if (state.phase === "pending") return { phase: "idle", open: !state.open };
    return { phase: "idle", open: state.open };
  }
  if (event === "cancel") return { phase: "idle", open: state.phase === "holding" ? false : state.open };
  if (event === "outside" || event === "toggle") return { phase: "idle", open: event === "toggle" ? !state.open : false };
  return state;
}

export function carbWhy(tg: TodayTargets & { tdee: number }, train: boolean): string[] {
  const sum = r0(tg.pRef * 4 + tg.cRef * 4 + tg.f * 9);
  const kind = train ? "训练日" : "休息日";
  const gap = r0(tg.tdee - tg.kcal);
  const range = `蛋白每天 ${proteinBand(tg.pMin, tg.pMax)}g，到 ${tg.pMin}g 就算吃够。碳水 ${proteinBand(tg.cMin, tg.cMax)}g，到 ${tg.cMin}g 就算吃够，超过 ${tg.cMax}g 只轻轻提示。`;
  const budget = sum === tg.kcal
    ? `热量已经算好：${kind} 蛋白${tg.pRef}g×4 + 碳水${tg.cRef}g×4 + 脂肪${tg.f}g×9 = ${sum} kcal。${range}脂肪守住，热量刚好在线。`
    : `热量已经算好：${kind} 蛋白${tg.pRef}g×4 + 碳水${tg.cRef}g×4 + 脂肪${tg.f}g×9 = ${sum} kcal，当天热量目标 ${tg.kcal} kcal。${range}`;
  const room = gap > 0
    ? `目标本身低于消耗约 ${gap} kcal，偶尔多一两百 kcal 仍在缺口里。热量容易超的是油和零食，不是主食。`
    : "热量容易超的是油和零食，不是主食。";
  return [
    "碳水和脂肪分开算：米饭、面、燕麦、红薯、土豆、香蕉几乎不含脂肪，多吃主食只加碳水，脂肪基本不变。",
    "脂肪超标多来自炒菜油、肥肉、坚果、油炸和酱料；训练日多加主食、少放油，蛋白选鸡胸、鱼虾、瘦牛肉、蛋清。",
    budget,
    room,
    "吃够的碳水用来补充训练消耗的肌糖原，不会变成腹部脂肪。",
  ];
}

export function todayAnalysis(tot: Macros, tg: TodayTargets, train: boolean, hour = 12): { lines: GapLine[]; summary: string; advice: string } {
  const lines = [
    gapLine("热量", "kcal", tot.k, tg.kcal, false),
    rangeLine("蛋白", tot.p, tg.pMin, tg.pMax, "下限"),
    rangeLine("碳水", tot.c, tg.cMin, tg.cMax, "最低"),
    gapLine("脂肪", "g", tot.f, tg.f, false),
  ];
  const summary = lines.map((l) => l.text).join(" · ");
  const proteinShort = tg.pMin - tot.p >= 20;
  const carbShort = tg.c - tot.c >= 40;
  const carbNeed = train && tot.c + 1e-6 < tg.c;
  const fat = fatLeftLabel(tot.f, tg.f);
  const fatRatio = tg.f > 0 ? tot.f / tg.f : 0;
  const fatHot = fatRatio >= 0.9;
  const kcalOver = tot.k > tg.kcal;
  const kcalNear = !kcalOver && tot.k >= tg.kcal * 0.9;
  const kcalTooLow = train && hour >= 16 && tot.k < tg.kcal - 400;
  const kcalLeft = tg.kcal - tot.k;
  const macroNeed = Math.max(0, tg.pMin - tot.p) * 4 + Math.max(0, tg.c - tot.c) * 4;
  let advice = "下一餐照常，热量不必吃满";
  if (kcalOver) advice = "下一餐清淡一点";
  else if (kcalTooLow) advice = "别吃太少";
  else if (carbNeed && fatRatio >= 0.8) advice = fat.tone === "over"
    ? `下一餐少油，碳水还可以吃，${fat.text}`
    : `下一餐：多主食、少油，${fat.text}`;
  else if (fat.tone === "over" && proteinShort) advice = "下一餐少油，补蛋白。碳水还可以吃";
  else if (fat.tone === "over") advice = "下一餐少油。碳水还可以吃";
  else if (fatHot) advice = `下一餐少油，${fat.text}`;
  else if (kcalLeft < macroNeed) advice = `先补蛋白，再补碳水，不加脂肪。${fat.text}`;
  else if (proteinShort && train && carbShort) advice = "下一餐：补蛋白，再补碳";
  else if (proteinShort) advice = "下一餐：补蛋白";
  else if (train && carbShort) advice = "下一餐：补碳";
  else if (kcalNear) advice = "下一餐清淡一点";
  return { lines, summary, advice };
}

export type ReminderId = "pre-carb" | "post-train" | "evening-protein" | "fat-over";
export type Reminder = { id: ReminderId; text: string };

export function shanghaiClock(now: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { h: h === 24 ? 0 : h, m };
}

export function dueReminders(input: { h: number; m: number; train: boolean; meals: readonly string[]; breakfastCarbs: number | null; tot: Macros; tg: TodayTargets }): Reminder[] {
  const mins = input.h * 60 + input.m;
  const out: Reminder[] = [];
  if (input.tot.f > input.tg.f) out.push({ id: "fat-over", text: "脂肪已经超了，后面控油。" });
  if (mins >= 19 * 60 && input.tg.p - input.tot.p >= 30) out.push({ id: "evening-protein", text: "晚上了，蛋白还差不少，补一份蛋白或乳清。" });
  if (input.train && mins >= 10 * 60 + 20 && !input.meals.includes("训练后")) out.push({ id: "post-train", text: "训练后还没记，补蛋白和碳水。" });
  if (input.train && mins >= 5 * 60 && mins < 10 * 60 + 20 && (input.breakfastCarbs == null || input.breakfastCarbs < 40)) out.push({ id: "pre-carb", text: "训练前先吃碳水，大约 40–60g。" });
  return out;
}

export function pickReminder(due: readonly Reminder[], seen: readonly string[]): Reminder | null {
  return due.find((r) => !seen.includes(r.id)) ?? null;
}

export type ReminderStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export function seenReminders(date: string, kv: ReminderStore): string[] {
  try {
    const all = JSON.parse(kv.getItem("fl_remind_seen") || "{}") as Record<string, unknown>;
    const day = all[date];
    return Array.isArray(day) ? day.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

export function markReminderSeen(date: string, id: string, kv: ReminderStore): void {
  let all: Record<string, string[]> = {};
  try { all = JSON.parse(kv.getItem("fl_remind_seen") || "{}"); } catch { all = {}; }
  const day = new Set([...(Array.isArray(all[date]) ? all[date] : []), id]);
  all[date] = [...day];
  const dates = Object.keys(all).sort();
  while (dates.length > 21) { const drop = dates.shift(); if (drop) delete all[drop]; }
  kv.setItem("fl_remind_seen", JSON.stringify(all));
}

export function sumEntries(es: readonly { k: number; p: number; c: number; f: number }[]): Macros {
  return es.reduce((a, e) => ({
    k: a.k + (Number(e.k) || 0),
    p: a.p + (Number(e.p) || 0),
    c: a.c + (Number(e.c) || 0),
    f: a.f + (Number(e.f) || 0),
  }), { k: 0, p: 0, c: 0, f: 0 });
}

export const QTY_CHIPS = [0.5, 1, 1.5, 2, 3];

export function formatQty(q: number): string {
  const n = Math.round(q * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function clampQty(q: number): number {
  const stepped = Math.round(q * 2) / 2;
  return Math.min(10, Math.max(0.5, stepped));
}

export function scaleEntryGrams<T extends { grams: number; k: number; p: number; c: number; f: number }>(e: T, grams: number): T {
  if (!(grams > 0) || !(e.grams > 0)) return e;
  const m = grams / e.grams;
  return { ...e, grams, k: e.k * m, p: e.p * m, c: e.c * m, f: e.f * m };
}

export function scaleEntryKcal<T extends { k: number; p: number; c: number; f: number }>(e: T, kcal: number): T {
  if (!(kcal > 0) || !(e.k > 0)) return e;
  const m = kcal / e.k;
  return { ...e, k: kcal, p: e.p * m, c: e.c * m, f: e.f * m };
}

export function applyQty<T extends { name: string; grams: number; k: number; p: number; c: number; f: number; qty?: number }>(e: T, qty: number): T {
  const q = clampQty(qty);
  const prev = e.qty && e.qty > 0 ? e.qty : 1;
  const m = q / prev;
  const base = e.name.replace(/\s*×[\d.]+$/, "");
  return { ...e, qty: q, name: `${base} ×${formatQty(q)}`, k: e.k * m, p: e.p * m, c: e.c * m, f: e.f * m, grams: e.grams ? Math.round(e.grams * m * 10) / 10 : 0 };
}

export function entryFromSupplement(it: { n: string; k: number; p: number; c: number; f: number }, qty: number): { meal: string; name: string; grams: number; k: number; p: number; c: number; f: number; qty: number } {
  const q = clampQty(qty);
  return { meal: "加餐", name: `${it.n} ×${formatQty(q)}`, grams: 0, k: it.k * q, p: it.p * q, c: it.c * q, f: it.f * q, qty: q };
}

export function entryFromFood(f: Food, grams: number, meal: string): Omit<Entry, "id"> {
  const x = f.su ? grams : grams / 100;
  return {
    meal,
    name: f.su ? `${f.n} ${grams}${f.su}` : f.n,
    grams: f.su ? 0 : grams,
    k: f.k * x,
    p: f.p * x,
    c: f.c * x,
    f: f.f * x,
  };
}

export function isBaseFoodName(name: string, baseNames: readonly string[]): boolean {
  return baseNames.some((b) => name === b || name.startsWith(b + " "));
}

export function foodFromEntry(e: Entry, isLibraryName: (name: string) => boolean): Food | null {
  const n = (e.name || "").replace(/\(自定义\)\s*$/, "").trim();
  if (!n || isLibraryName(n)) return null;
  if (e.grams > 0) {
    const m = 100 / e.grams;
    return { n, k: r0(e.k * m), p: +(e.p * m).toFixed(1), c: +(e.c * m).toFixed(1), f: +(e.f * m).toFixed(1), g: e.grams, u: "100g", t: "我的食物", mine: true };
  }
  return { n, k: e.k, p: e.p, c: e.c, f: e.f, g: 1, su: "份", u: "每份", t: "我的食物", mine: true };
}

export type HeatStatus = "未记录" | "未超标" | "超出";
export type SavedDayTarget = { kcal: number; p: number; c: number; f: number };
export type DayStat = Macros & {
  date: string;
  entries: number;
  train: boolean;
  targetK: number;
  targetP: number;
  targetPMin: number;
  targetPMax: number;
  targetC: number;
  targetCMin: number;
  targetCMax: number;
  targetF: number;
  targetSource: "saved" | "recalculated";
  tdee: number;
  status: HeatStatus;
  shownK: number;
  gap: number;
  adherence: number;
};

export type GroupAvg = { days: number; k: number; p: number; c: number; f: number; targetK: number; targetP: number; targetPMax: number; targetC: number; targetCMax: number; targetF: number; adherence: number };

export type WindowStats = {
  days: DayStat[];
  logged: DayStat[];
  unlogged: number;
  overCount: number;
  withinCount: number;
  kcalPositive: number;
  avgKLogged: number;
  avgPLogged: number;
  avgCLogged: number;
  avgFLogged: number;
  avgKAll: number;
  avgPAll: number;
  avgTargetKLogged: number;
  pHitLogged: number;
  proteinReached: number;
  proteinDays: number;
  trainCarbReached: number;
  trainLogged: number;
  trainAvg: GroupAvg;
  restAvg: GroupAvg;
  avgDeficit: number;
};

export function heatStatus(kcal: number, target: number, entries: number): HeatStatus {
  if (!(entries > 0)) return "未记录";
  return kcal > target ? "超出" : "未超标";
}

export function savedDayTarget(raw: Partial<SavedDayTarget> | undefined): SavedDayTarget | null {
  if (!raw) return null;
  const nums = [raw.kcal, raw.p, raw.c, raw.f];
  if (nums.some((n) => typeof n !== "number" || !isFinite(n) || n < 0)) return null;
  return { kcal: raw.kcal as number, p: raw.p as number, c: raw.c as number, f: raw.f as number };
}

function avgOf(rows: readonly DayStat[], key: keyof Macros | "targetK" | "targetP" | "targetPMax" | "targetC" | "targetCMax" | "targetF" | "tdee"): number {
  if (!rows.length) return 0;
  return r0(rows.reduce((a, d) => a + d[key], 0) / rows.length);
}

function groupAvg(rows: readonly DayStat[]): GroupAvg {
  const adherence = rows.length ? r0(rows.reduce((a, d) => a + d.adherence, 0) / rows.length) : 0;
  return { days: rows.length, k: avgOf(rows, "k"), p: avgOf(rows, "p"), c: avgOf(rows, "c"), f: avgOf(rows, "f"), targetK: avgOf(rows, "targetK"), targetP: avgOf(rows, "targetP"), targetPMax: avgOf(rows, "targetPMax"), targetC: avgOf(rows, "targetC"), targetCMax: avgOf(rows, "targetCMax"), targetF: avgOf(rows, "targetF"), adherence };
}

export function analyzeWindow(log: Record<string, readonly Entry[] | undefined>, end: string, profile: Profile, saved?: Record<string, Partial<SavedDayTarget> | undefined>): WindowStats {
  const days: DayStat[] = lastNDays(end, 7).map((date) => {
    const es = log[date] || [];
    const s = sumEntries(es);
    const train = isTrain(date);
    const recalc = calcTargets(profile, train);
    const keep = savedDayTarget(saved?.[date]);
    const targetK = keep ? keep.kcal : recalc.kcal;
    const targetPMin = keep ? keep.p : recalc.pMin;
    const targetPMax = keep ? keep.p : recalc.pMax;
    const targetP = targetPMin;
    const targetCMin = keep ? keep.c : recalc.cMin;
    const targetCMax = keep ? keep.c : recalc.cMax;
    const targetC = targetCMin;
    const targetF = keep ? keep.f : recalc.f;
    const entries = es.length;
    const status = heatStatus(s.k, targetK, entries);
    const adherence = entries > 0 && targetK > 0 ? Math.round(s.k / targetK * 100) : 0;
    return { date, ...s, entries, train, targetK, targetP, targetPMin, targetPMax, targetC, targetCMin, targetCMax, targetF, targetSource: keep ? "saved" : "recalculated", tdee: recalc.tdee, status, shownK: Math.round(s.k), gap: Math.round(Math.abs(targetK - s.k)), adherence };
  });
  const logged = days.filter((d) => d.entries > 0);
  const trainLogged = logged.filter((d) => d.train);
  const restLogged = logged.filter((d) => !d.train);
  return {
    days,
    logged,
    unlogged: days.filter((d) => d.status === "未记录").length,
    overCount: days.filter((d) => d.status === "超出").length,
    withinCount: days.filter((d) => d.status === "未超标").length,
    kcalPositive: days.filter((d) => d.k > 0).length,
    avgKLogged: avgOf(logged, "k"),
    avgPLogged: avgOf(logged, "p"),
    avgCLogged: avgOf(logged, "c"),
    avgFLogged: avgOf(logged, "f"),
    avgKAll: avgOf(days, "k"),
    avgPAll: avgOf(days, "p"),
    avgTargetKLogged: avgOf(logged, "targetK"),
    pHitLogged: logged.filter((d) => d.p >= d.targetP * 0.95).length,
    proteinReached: logged.filter((d) => d.p >= d.targetPMin).length,
    proteinDays: logged.length,
    trainCarbReached: trainLogged.filter((d) => d.c >= d.targetC).length,
    trainLogged: trainLogged.length,
    trainAvg: groupAvg(trainLogged),
    restAvg: groupAvg(restLogged),
    avgDeficit: avgOf(logged.map((d) => ({ ...d, k: d.tdee - d.k })), "k"),
  };
}

export type WeekDayBalance = {
  date: string;
  train: boolean;
  logged: boolean;
  p: number;
  c: number;
  f: number;
  k: number;
  pMin: number;
  cMin: number;
  targetF: number;
  targetK: number;
  carbGap: number;
  fatGap: number;
  proteinHit: boolean;
  carbHit: boolean;
};

export type WeekBalance = {
  days: WeekDayBalance[];
  logged: number;
  kcalActual: number;
  kcalTarget: number;
  kcalNet: number;
  fatOverG: number;
  fatOverKcal: number;
  carbShortG: number;
  carbShortKcal: number;
  offset: "抵消" | "脂肪更多" | "碳水缺口更大" | "无明显对冲";
  tradeoff: string;
  conclusion: string;
  badge: "平衡" | "偏高" | "注意";
  bar: "ok" | "high";
  reason: string;
  warn: string;
  proteinHits: number;
  proteinOk: boolean;
};

export function weekBalance(w: WindowStats): WeekBalance {
  const days: WeekDayBalance[] = w.days.map((d) => {
    const logged = d.entries > 0;
    return {
      date: d.date, train: d.train, logged, p: d.p, c: d.c, f: d.f, k: d.k,
      pMin: d.targetPMin, cMin: d.targetCMin, targetF: d.targetF, targetK: d.targetK,
      carbGap: logged ? d.c - d.targetCMin : 0,
      fatGap: logged ? d.f - d.targetF : 0,
      proteinHit: logged && d.p + 1e-6 >= d.targetPMin,
      carbHit: logged && d.c + 1e-6 >= d.targetCMin,
    };
  });
  const loggedDays = days.filter((d) => d.logged);
  const kcalActual = r0(loggedDays.reduce((a, d) => a + d.k, 0));
  const kcalTarget = r0(loggedDays.reduce((a, d) => a + d.targetK, 0));
  const kcalNet = kcalTarget - kcalActual;
  const fatOverG = r0(loggedDays.reduce((a, d) => a + Math.max(0, d.fatGap), 0));
  const carbShortG = r0(loggedDays.reduce((a, d) => a + Math.max(0, -d.carbGap), 0));
  const fatOverKcal = fatOverG * 9;
  const carbShortKcal = carbShortG * 4;
  let offset: WeekBalance["offset"] = "无明显对冲";
  if (fatOverG >= 5 || carbShortG >= 10) {
    const diff = fatOverKcal - carbShortKcal;
    offset = Math.abs(diff) <= 80 ? "抵消" : diff > 0 ? "脂肪更多" : "碳水缺口更大";
  }
  const tail = offset === "抵消" ? "一周热量基本持平" : offset === "脂肪更多" ? "脂肪多出的热量更多" : offset === "碳水缺口更大" ? "碳水少掉的热量更多" : "没有明显的脂肪和碳水对冲";
  const tradeoff = loggedDays.length ? `脂肪多 ${fatOverG}g≈${fatOverKcal}kcal，碳水少 ${carbShortG}g≈${carbShortKcal}kcal，${tail}` : "没有已记录的日子。";
  const trainCarbShort = loggedDays.some((d) => d.train && d.carbGap < -1);
  const proteinHits = loggedDays.filter((d) => d.proteinHit).length;
  const proteinOk = loggedDays.length > 0 && proteinHits * 7 >= loggedDays.length * 5;
  const overPct = kcalTarget > 0 && (kcalActual - kcalTarget) / kcalTarget > 0.05;
  const badge: WeekBalance["badge"] = !loggedDays.length ? "注意" : overPct ? "偏高" : proteinOk ? "平衡" : "注意";
  const bar: WeekBalance["bar"] = overPct ? "high" : "ok";
  const reason = !loggedDays.length ? "这 7 天还没有饮食记录。" : overPct ? `热量超出 ${kcalActual - kcalTarget} kcal。` : kcalNet > 0 ? `热量缺口 ${kcalNet} kcal，有利减脂。` : "热量与目标持平。";
  const warns: string[] = [];
  if (loggedDays.length && !proteinOk) warns.push(`蛋白达标 ${proteinHits}/${loggedDays.length}，未到记录天数的 5/7。`);
  if (loggedDays.length && trainCarbShort && fatOverG >= 10) warns.push(`脂肪多 +${fatOverKcal}kcal 被碳水少 −${carbShortKcal}kcal 抵消，但训练日碳水不足。`);
  const warn = warns.join("");
  const conclusion = reason;
  return { days, logged: loggedDays.length, kcalActual, kcalTarget, kcalNet, fatOverG, fatOverKcal, carbShortG, carbShortKcal, offset, tradeoff, conclusion, badge, bar, reason, warn, proteinHits, proteinOk };
}

export function streakCount(log: Record<string, readonly unknown[] | undefined>, today: string): number {
  let d = today;
  if (!(log[d]?.length)) d = addDays(d, -1);
  let n = 0;
  while (log[d]?.length) {
    n += 1;
    if (n > 4000) break;
    d = addDays(d, -1);
  }
  return n;
}

export function normFoodName(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\(自定义\)\s*$/g, "").replace(/\s+/g, "");
}

export function isSameFoodName(a: string, b: string): boolean {
  const x = normFoodName(a), y = normFoodName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const tail = (rest: string) => /^(\d+(?:\.\d+)?)(g|克|勺|份|个|ml|毫升)?$/.test(rest);
  if (y.startsWith(x) && tail(y.slice(x.length))) return true;
  if (x.startsWith(y) && tail(x.slice(y.length))) return true;
  return false;
}

export function foodFromLoggedServing(e: Entry): Food | null {
  const n = (e.name || "").replace(/\(自定义\)\s*$/, "").trim();
  if (!n) return null;
  if (e.grams > 0) {
    const m = 100 / e.grams;
    return { n, k: r0(e.k * m), p: +(e.p * m).toFixed(1), c: +(e.c * m).toFixed(1), f: +(e.f * m).toFixed(1), g: e.grams, u: "100g", t: "最近", mine: true };
  }
  return { n, k: e.k, p: e.p, c: e.c, f: e.f, g: 1, su: "份", u: "按这次记录的一份", t: "最近", mine: true };
}

export function mergeSearchFoods(base: readonly Food[], mine: readonly Food[], history: readonly Entry[]): Food[] {
  const out: Food[] = [];
  const names: string[] = [];
  const push = (f: Food) => {
    if (!f || !f.n || names.some((n) => isSameFoodName(n, f.n))) return;
    names.push(f.n);
    out.push(f);
  };
  for (const f of mine) push(f);
  for (const f of base) push(f);
  for (const e of history) {
    const f = foodFromLoggedServing(e);
    if (f) push(f);
  }
  return out;
}

export function movingAverage(points: { date: string; value: number }[], windowDays = 7): { date: string; value: number }[] {
  return points.map((b) => {
    const win = points.filter((x) => {
      const diff = dayDiff(x.date, b.date);
      return diff >= 0 && diff < windowDays;
    });
    const v = win.reduce((a, x) => a + x.value, 0) / (win.length || 1);
    return { date: b.date, value: +v.toFixed(1) };
  });
}
