export type Food = { n: string; k: number; p: number; c: number; f: number; g: number; u: string; t?: string; su?: string; mine?: boolean };
export type Entry = { id: number; meal: string; name: string; grams: number; k: number; p: number; c: number; f: number };
export type Profile = {
  h: string; w: string; age: string; bf: string; act: string; def: string; wt?: string;
  bmr?: string;
  tk?: string; tp?: string; tc?: string; tf?: string;
  rk?: string; rp?: string; rc?: string; rf?: string;
};
export const PROFILE_DEFAULT: Profile = { h: "170", w: "80.1", age: "34", bf: "17.7", bmr: "1795", act: "1.6", def: "18" };
export type Body = { date: string; w: number; waist: number };
export type Macros = { k: number; p: number; c: number; f: number };

export const MEALS = ["早餐", "训练后", "午餐", "晚餐", "加餐"] as const;

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
  const hasBf = lbm < w - 0.05;
  const p0 = r0(hasBf ? lbm * 2.5 : w * 2.06);
  const c0 = r0(w * (train ? 3 : 1.5));
  const f0 = r0(w * (train ? 0.687 : 0.812));
  const p = opt(train ? pr.tp : pr.rp, p0);
  const c = opt(train ? pr.tc : pr.rc, c0);
  const f = opt(train ? pr.tf : pr.rf, f0);
  const kcal = opt(train ? pr.tk : pr.rk, r0(p * 4 + c * 4 + f * 9));
  return { bmr: r0(bmr), bmrSource: source, lbm: Math.round(lbm * 10) / 10, tdee: r0(bmr * mult), kcal, p, c, f };
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

export type GapTone = "ok" | "low" | "near" | "over";
export type GapLine = { name: string; text: string; tone: GapTone };
export type TodayTargets = { kcal: number; p: number; c: number; f: number };

function macroPct(v: number, t: number): number { return t > 0 ? Math.round(v / t * 100) : 0; }

function gapLine(name: string, unit: string, value: number, target: number, kind: "ceiling" | "fill"): GapLine {
  const left = Math.max(0, r0(target - value));
  const over = Math.max(0, r0(value - target));
  const p = macroPct(value, target);
  const u = unit === "kcal" ? " kcal" : unit;
  if (value > target) return { name, text: `${name}已超 ${over}${u}`, tone: "over" };
  if (kind === "ceiling") return { name, text: `${name}还可吃 ${left}${u}`, tone: p >= 90 ? "near" : "ok" };
  if (p >= 90) return { name, text: `${name}已到 ${p}%`, tone: "near" };
  return { name, text: `${name}还差 ${left}${u}`, tone: "low" };
}

export function todayAnalysis(tot: Macros, tg: TodayTargets, train: boolean, hour = 12): { lines: GapLine[]; summary: string; advice: string } {
  const lines = [
    gapLine("热量", "kcal", tot.k, tg.kcal, "ceiling"),
    gapLine("蛋白", "g", tot.p, tg.p, "fill"),
    gapLine("碳水", "g", tot.c, tg.c, "fill"),
    gapLine("脂肪", "g", tot.f, tg.f, "fill"),
  ];
  const summary = lines.map((l) => l.text).join(" · ");
  const proteinShort = tg.p - tot.p >= 20;
  const carbShort = tg.c - tot.c >= 40;
  const fatHot = tot.f >= tg.f * 0.9;
  const kcalOver = tot.k > tg.kcal;
  const kcalNear = !kcalOver && tot.k >= tg.kcal * 0.9;
  const kcalTooLow = train && hour >= 16 && tot.k < tg.kcal - 400;
  let advice = train ? "按训练日高碳继续。热量是上限，不必吃满。" : "按休息日低碳继续。热量是上限，不必吃满。";
  if (kcalOver) advice = "热量已超上限，后面清淡一点。";
  else if (kcalTooLow) advice = "训练日热量明显不足，别吃太少。";
  else if (fatHot && tot.f > tg.f && proteinShort) advice = "脂肪已超标，后面少油；蛋白用乳清补一点。";
  else if (fatHot && tot.f > tg.f) advice = "脂肪已超标，后面少油。";
  else if (fatHot) advice = "脂肪已接近目标，后面少油。";
  else if (proteinShort && train && carbShort) advice = "蛋白还不够，建议补蛋白或乳清；训练前后再补碳。";
  else if (proteinShort) advice = "蛋白还不够，建议补蛋白或乳清。";
  else if (train && carbShort) advice = "训练日碳水不足，训练前后补碳。";
  else if (kcalNear) advice = "热量已接近上限，后面清淡一点。";
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
  targetC: number;
  targetF: number;
  targetSource: "saved" | "recalculated";
  status: HeatStatus;
  shownK: number;
  gap: number;
};

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

function avgOf(rows: readonly DayStat[], key: keyof Macros | "targetK"): number {
  if (!rows.length) return 0;
  return r0(rows.reduce((a, d) => a + d[key], 0) / rows.length);
}

export function analyzeWindow(log: Record<string, readonly Entry[] | undefined>, end: string, profile: Profile, saved?: Record<string, Partial<SavedDayTarget> | undefined>): WindowStats {
  const days: DayStat[] = lastNDays(end, 7).map((date) => {
    const es = log[date] || [];
    const s = sumEntries(es);
    const train = isTrain(date);
    const recalc = calcTargets(profile, train);
    const keep = savedDayTarget(saved?.[date]);
    const targetK = keep ? keep.kcal : recalc.kcal;
    const targetP = keep ? keep.p : recalc.p;
    const targetC = keep ? keep.c : recalc.c;
    const targetF = keep ? keep.f : recalc.f;
    const entries = es.length;
    const status = heatStatus(s.k, targetK, entries);
    return { date, ...s, entries, train, targetK, targetP, targetC, targetF, targetSource: keep ? "saved" : "recalculated", status, shownK: Math.round(s.k), gap: Math.round(Math.abs(targetK - s.k)) };
  });
  const logged = days.filter((d) => d.entries > 0);
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
  };
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
