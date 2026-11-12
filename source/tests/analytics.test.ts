import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { addDays, analyzeDates, analyzeWindow, bmrOf, calcTargets, dayDiff, entryFromFood, foodFromEntry, formatShanghai, isBaseFoodName, isTrain, lastNDays, mondayOf, movingAverage, needsTrainCarb, r0, streakCount, sumEntries, weekDates, weeklyDeficit, migrateProteinTargets, weekBalance, weekday, PROFILE_DEFAULT, type Entry, type Food, type Profile } from "../src/logic";

const profile: Profile = { h: "170", w: "82", age: "34", bf: "", act: "1.6", def: "18" };
const e = (id: number, k: number, p: number, c = 0, f = 0, grams = 100): Entry => ({ id, meal: "午餐", name: "食物", grams, k, p, c, f });

describe("Shanghai dates", () => {
  it("uses the Asia/Shanghai calendar day, including the 16:00 UTC boundary", () => {
    expect(formatShanghai(new Date("2026-11-08T15:59:59Z"))).toBe("2026-11-08");
    expect(formatShanghai(new Date("2026-11-08T16:00:00Z"))).toBe("2026-11-09");
  });
  it("shifts calendar dates without depending on the machine timezone", () => {
    expect(addDays("2026-11-08", -10)).toBe("2026-10-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayDiff("2026-11-01", "2026-11-08")).toBe(7);
    expect(lastNDays("2026-11-08", 7)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });
  it("treats Monday–Friday as training days from the calendar date", () => {
    expect(isTrain("2026-11-06")).toBe(true);
    expect(isTrain("2026-11-07")).toBe(false);
    expect(isTrain("2026-11-08")).toBe(false);
    expect(isTrain("2026-11-09")).toBe(true);
  });
});

describe("sums and the 7-day window", () => {
  it("sums stored entry totals", () => {
    expect(sumEntries([e(1, 1.2, 0.4, 1, 0.5), e(2, 2.3, 0.6, 2, 0.5)])).toEqual({ k: 3.5, p: 1, c: 3, f: 1 });
  });
  it("keeps a logged-day average separate from the 7-day average that counts blanks as zero", () => {
    const end = "2026-11-08";
    const log = { [addDays(end, -1)]: [e(1, 2100, 100)] };
    const w = analyzeWindow(log, end, profile);
    expect(w.days).toHaveLength(7);
    expect(w.days[6].date).toBe(end);
    expect(w.logged).toHaveLength(1);
    expect(w.avgKLogged).toBe(2100);
    expect(w.avgKAll).toBe(r0(2100 / 7));
    expect(w.avgPLogged).toBe(100);
    expect(w.avgPAll).toBe(r0(100 / 7));
  });
  it("counts a 0 kcal entry as logged, which the old kcal>0 filter did not", () => {
    const end = "2026-11-08";
    const w = analyzeWindow({ [end]: [e(1, 0, 0, 0, 0, 5)] }, end, profile);
    expect(w.logged).toHaveLength(1);
    expect(w.kcalPositive).toBe(0);
    expect(w.avgKLogged).toBe(0);
  });
  it("judges each day against that day's own calorie target", () => {
    const fri = "2026-11-06";
    const sat = "2026-11-07";
    const trainK = calcTargets(profile, true).kcal;
    const restK = calcTargets(profile, false).kcal;
    expect(trainK).toBeGreaterThan(restK);
    const w = analyzeWindow({
      [fri]: [e(1, trainK, 200)],
      [sat]: [e(2, restK, 200)],
    }, "2026-11-08", profile);
    expect(w.days.find((d) => d.date === fri)?.targetK).toBe(trainK);
    expect(w.days.find((d) => d.date === sat)?.targetK).toBe(restK);
    expect(w.withinCount).toBe(2);
    expect(w.overCount).toBe(0);
    expect(w.days.find((d) => d.date === fri)?.status).toBe("未超标");
    expect(w.days.find((d) => d.date === sat)?.status).toBe("未超标");
    expect(w.avgTargetKLogged).toBe(r0((trainK + restK) / 2));
    expect(w.pHitLogged).toBe(2);
  });
  it("does not treat unlogged days as protein hits", () => {
    const end = "2026-11-08";
    const targetP = calcTargets(profile, true).p;
    const w = analyzeWindow({ [end]: [e(1, 500, targetP)] }, end, profile);
    expect(w.pHitLogged).toBe(1);
    expect(w.logged).toHaveLength(1);
    expect(w.unlogged).toBe(6);
    expect(w.days.filter((d) => d.date !== end).every((d) => d.status === "未记录")).toBe(true);
  });
  it("counts a streak up to today, or through yesterday when today is empty", () => {
    const today = "2026-11-08";
    const log = { [addDays(today, -1)]: [e(1, 1, 1)], [addDays(today, -2)]: [e(2, 1, 1)] };
    expect(streakCount(log, today)).toBe(2);
    expect(streakCount({ ...log, [today]: [e(3, 1, 1)] }, today)).toBe(3);
    expect(streakCount({ [addDays(today, -2)]: [e(2, 1, 1)] }, today)).toBe(0);
  });
  it("uses seven calendar points for the moving average", () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ date: addDays("2026-11-01", i), value: 80 }));
    const ma = movingAverage(points);
    expect(ma[9].value).toBe(80);
    const win = points.filter((p) => dayDiff(p.date, points[9].date) >= 0 && dayDiff(p.date, points[9].date) < 7);
    expect(win).toHaveLength(7);
  });
});

describe("per 100g and servings", () => {
  const rice: Food = { n: "米饭(熟)", k: 116, p: 2.6, c: 25.9, f: 0.3, g: 200, u: "一碗约200g" };
  const whey: Food = { n: "乳清蛋白(按勺)", k: 150, p: 30, c: 4, f: 2, g: 1, su: "勺", u: "1勺" };
  it("scales rice by grams/100 and scoops by count", () => {
    expect(entryFromFood(rice, 200, "午餐")).toMatchObject({ grams: 200, k: 232, name: "米饭(熟)" });
    expect(entryFromFood(rice, 50, "午餐").k).toBe(58);
    expect(entryFromFood(whey, 2, "加餐")).toMatchObject({ grams: 0, k: 300, name: "乳清蛋白(按勺) 2勺" });
  });
  it("does not turn a logged scoop back into a second library food", () => {
    const logged = entryFromFood(whey, 1, "加餐");
    expect(foodFromEntry({ ...logged, id: 1 }, (n) => isBaseFoodName(n, [whey.n, rice.n]))).toBeNull();
  });
  it("round-trips a custom gram entry through per-100g without doubling", () => {
    const logged: Entry = { id: 1, meal: "午餐", name: "食堂", grams: 200, k: 232, p: 5.2, c: 50, f: 2 };
    const saved = foodFromEntry(logged, () => false);
    expect(saved?.k).toBe(116);
    expect(entryFromFood(saved!, saved!.g, "午餐").k).toBe(232);
  });
});

describe("6 November 2026 training day", () => {
  const end = "2026-11-08";
  const trainK = calcTargets(profile, true).kcal;
  const restK = calcTargets(profile, false).kcal;
  const nov6 = (k: number) => analyzeWindow({ "2026-11-06": [e(1, k, 10)] }, end, profile).days.find((d) => d.date === "2026-11-06")!;
  it("uses the training target, and a value between rest and training is not over", () => {
    expect(isTrain("2026-11-06")).toBe(true);
    expect(trainK).toBeGreaterThan(restK);
    const mid = restK + 1;
    expect(mid).toBeLessThan(trainK);
    const d = nov6(mid);
    expect(d.targetK).toBe(trainK);
    expect(d.targetSource).toBe("recalculated");
    expect(d.status).toBe("未超标");
    expect(d.shownK).toBe(mid);
  });
  it("treats calories equal to the training target as not over, matching the today ring", () => {
    expect(nov6(trainK).status).toBe("未超标");
    expect(nov6(trainK).gap).toBe(0);
  });
  it("treats calories above the training target as over", () => {
    const d = nov6(trainK + 40);
    expect(d.status).toBe("超出");
    expect(d.gap).toBe(40);
  });
  it("keeps an empty day as 未记录 in a mixed week and uses a saved target only when one exists", () => {
    const w = analyzeWindow({
      "2026-11-05": [e(1, trainK + 20, 10)],
      "2026-11-06": [e(2, trainK - 30, 10)],
      "2026-11-07": [e(3, restK + 10, 10)],
    }, end, profile, { "2026-11-07": { kcal: restK - 50, p: 10, c: 10, f: 10 } });
    const by = (iso: string) => w.days.find((d) => d.date === iso)!;
    expect(by("2026-11-05").status).toBe("超出");
    expect(by("2026-11-05").targetSource).toBe("recalculated");
    expect(by("2026-11-06").status).toBe("未超标");
    expect(by("2026-11-06").targetK).toBe(trainK);
    expect(by("2026-11-07").targetSource).toBe("saved");
    expect(by("2026-11-07").targetK).toBe(restK - 50);
    expect(by("2026-11-07").status).toBe("超出");
    expect(by("2026-11-08").status).toBe("未记录");
    expect(w.unlogged).toBe(4);
    expect(w.overCount).toBe(2);
    expect(w.withinCount).toBe(1);
    expect(w.days.filter((d) => d.status === "未记录").every((d) => d.entries === 0)).toBe(true);
  });
});

describe("carb cycle from the 2026-11-11 measurement", () => {
  const pr = PROFILE_DEFAULT;
  it("prefers the entered BMR, otherwise Katch-McArdle from body fat", () => {
    expect(bmrOf(pr)).toMatchObject({ source: "measured", bmr: 1795 });
    const katch = bmrOf({ ...pr, bmr: "" });
    expect(katch.source).toBe("katch");
    expect(katch.bmr).toBeCloseTo(370 + 21.6 * 80.1 * (1 - 0.177), 5);
    expect(bmrOf({ ...pr, bmr: "", bf: "" }).source).toBe("mifflin");
  });
  it("lands near the high-carb training day and low-carb rest day", () => {
    const t = calcTargets(pr, true);
    const r = calcTargets(pr, false);
    expect(t.lbm).toBe(65.9);
    expect(t.pMin).toBe(160);
    expect(t.pMax).toBe(175);
    expect(t.pRef).toBe(174);
    expect(t.p).toBe(160);
    expect(t.cMin).toBe(220);
    expect(t.cMax).toBe(240);
    expect(t.cRef).toBe(240);
    expect(t.c).toBe(220);
    expect(t.f).toBe(51);
    expect(t.kcal).toBe(4 * 174 + 4 * 240 + 9 * 51);
    expect(t.kcal).toBe(2115);
    expect(r.pMin).toBe(160);
    expect(r.pMax).toBe(175);
    expect(r.cMin).toBe(100);
    expect(r.cMax).toBe(120);
    expect(r.c).toBe(100);
    expect(r.f).toBe(61);
    expect(r.kcal).toBe(1725);
    expect(r.kcal).toBeGreaterThan(1700);
    expect(r.kcal).toBeLessThan(1800);
    expect(t.kcal).toBeGreaterThan(r.kcal);
    expect(weeklyDeficit(pr)).toBeGreaterThan(0);
  });
  it("lets a manual override replace one macro and keeps Friday on the training target", () => {
    const t = calcTargets({ ...pr, pLo: "170", pHi: "180" }, true);
    expect(t.pMin).toBe(170);
    expect(t.pMax).toBe(180);
    expect(t.cMin).toBe(220);
    expect(t.cRef).toBe(240);
    expect(t.kcal).toBe(2115);
    expect(calcTargets({ ...pr, tk: "2200" }, true).kcal).toBe(2200);
    const w = analyzeWindow({ "2026-11-06": [{ id: 1, meal: "午餐", name: "a", grams: 100, k: 2000, p: 150, c: 200, f: 50 }] }, "2026-11-08", pr);
    const fri = w.days.find((d) => d.date === "2026-11-06")!;
    expect(fri.train).toBe(true);
    expect(fri.targetK).toBe(calcTargets(pr, true).kcal);
    expect(fri.status).toBe("未超标");
    expect(needsTrainCarb(true, "早餐", 20)).toBe(true);
    expect(needsTrainCarb(true, "训练后", 39)).toBe(true);
    expect(needsTrainCarb(true, "午餐", 20)).toBe(false);
    expect(needsTrainCarb(false, "早餐", 10)).toBe(false);
    expect(needsTrainCarb(true, "早餐", 40)).toBe(false);
  });
});

describe("v35 protein migration", () => {
  it("drops stored auto protein 165/174 for the 160–175 range and keeps a real override", () => {
    const next = migrateProteinTargets({ ...PROFILE_DEFAULT, tp: "165", tf: "55", rp: "174", rf: "65", tc: "200" });
    expect(next.tp).toBe("");
    expect(next.rp).toBe("");
    expect(next.tf).toBe("51");
    expect(next.rf).toBe("61");
    expect(next.tc).toBe("200");
    expect(next.pLo).toBeUndefined();
    const custom = migrateProteinTargets({ ...PROFILE_DEFAULT, tp: "180", tf: "40", rp: "170", rf: "70" });
    expect(custom.pLo).toBe("170");
    expect(custom.pHi).toBe("180");
    expect(custom.tf).toBe("40");
    expect(custom.rf).toBe("70");
    expect(migrateProteinTargets(PROFILE_DEFAULT)).toEqual(PROFILE_DEFAULT);
    expect(calcTargets(next, true)).toMatchObject({ pMin: 160, pMax: 175, cMin: 220, cRef: 200, f: 51 });
    expect(calcTargets(custom, true)).toMatchObject({ pMin: 170, pMax: 180, f: 40 });
  });
});

describe("carb-cycle analytics", () => {
  const pr = PROFILE_DEFAULT;
  const train = calcTargets(pr, true);
  const rest = calcTargets(pr, false);
  const food = (id: number, k: number, p: number, c: number, f: number): Entry => ({ id, meal: "午餐", name: "a", grams: 100, k, p, c, f });
  it("uses each day's own target and excludes unlogged days from averages and must-reach counts", () => {
    expect(train.kcal).not.toBe(rest.kcal);
    const w = analyzeWindow({
      "2026-11-05": [food(1, train.kcal, train.p - 10, train.c - 10, 10)],
      "2026-11-06": [food(2, train.kcal, train.p, train.c, train.f)],
      "2026-11-07": [food(3, rest.kcal - 100, rest.p, rest.c - 30, 10)],
    }, "2026-11-08", pr);
    const by = (iso: string) => w.days.find((d) => d.date === iso)!;
    expect(by("2026-11-06").train).toBe(true);
    expect(by("2026-11-06").targetK).toBe(train.kcal);
    expect(by("2026-11-06").targetC).toBe(train.c);
    expect(by("2026-11-07").train).toBe(false);
    expect(by("2026-11-07").targetK).toBe(rest.kcal);
    expect(by("2026-11-07").targetC).toBe(rest.c);
    expect(by("2026-11-06").adherence).toBe(100);
    expect(by("2026-11-08").status).toBe("未记录");
    expect(w.proteinDays).toBe(3);
    expect(w.proteinReached).toBe(2);
    expect(by("2026-11-06").targetPMin).toBe(160);
    expect(by("2026-11-06").targetPMax).toBe(175);
    expect(by("2026-11-07").targetPMin).toBe(160);
    const band = analyzeWindow({
      "2026-11-06": [food(4, 1000, 159, 100, 20)],
      "2026-11-07": [food(5, 1000, 160, 80, 20)],
      "2026-11-08": [food(6, 1000, 180, 80, 20)],
    }, "2026-11-08", pr);
    expect(band.proteinDays).toBe(3);
    expect(band.proteinReached).toBe(2);
    expect(w.trainLogged).toBe(2);
    expect(w.trainCarbReached).toBe(1);
    expect(w.trainAvg.days).toBe(2);
    expect(w.trainAvg.targetK).toBe(train.kcal);
    expect(w.restAvg.days).toBe(1);
    expect(w.restAvg.k).toBe(rest.kcal - 100);
    expect(w.restAvg.targetK).toBe(rest.kcal);
    expect(w.unlogged).toBe(4);
    const deficit = r0(((train.tdee - train.kcal) + (train.tdee - train.kcal) + (rest.tdee - (rest.kcal - 100))) / 3);
    expect(w.avgDeficit).toBe(deficit);
  });
});

describe("week balance", () => {
  const pr = PROFILE_DEFAULT;
  const train = calcTargets(pr, true);
  const rest = calcTargets(pr, false);
  const food = (id: number, k: number, p: number, c: number, f: number): Entry => ({ id, meal: "午餐", name: "a", grams: 100, k, p, c, f });
  it("sums only logged days and compares fat surplus with carb shortfall", () => {
    const w = analyzeWindow({
      "2026-11-06": [food(1, train.kcal - 100, train.pMin, train.cMin - 40, train.f + 10)],
      "2026-11-07": [food(2, rest.kcal + 50, rest.pMin, rest.cMin - 20, rest.f + 8)],
    }, "2026-11-08", pr);
    const b = weekBalance(w);
    expect(b.logged).toBe(2);
    expect(b.days.filter((d) => !d.logged)).toHaveLength(5);
    expect(b.days.find((d) => d.date === "2026-11-08")?.logged).toBe(false);
    expect(b.carbShortG).toBe(60);
    expect(b.carbShortKcal).toBe(240);
    expect(b.fatOverG).toBe(18);
    expect(b.fatOverKcal).toBe(162);
    expect(b.kcalActual).toBe(train.kcal - 100 + rest.kcal + 50);
    expect(b.kcalTarget).toBe(train.kcal + rest.kcal);
    expect(b.kcalNet).toBe(50);
    expect(b.offset).toBe("抵消");
    expect(b.tradeoff).toContain("一周热量基本持平");
    expect(b.badge).toBe("平衡");
    expect(b.bar).toBe("ok");
    expect(b.reason).toBe("热量缺口 −50 kcal");
    expect(b.reason).not.toContain("偏低");
    expect(b.warn).toBe("脂肪多吃挤掉了碳水，训练日先吃够碳水");
    expect(b.p).toBe(train.pMin + rest.pMin);
    expect(b.pMin).toBe(train.pMin + rest.pMin);
    expect(b.pTone).toBe("ok");
    expect(b.c).toBe(train.cMin - 40 + rest.cMin - 20);
    expect(b.cMin).toBe(train.cMin + rest.cMin);
    expect(b.cTone).toBe("low");
    expect(b.f).toBe(train.f + 10 + rest.f + 8);
    expect(b.fTarget).toBe(train.f + rest.f);
    expect(b.fTone).toBe("high");
    expect(b.days.find((d) => d.date === "2026-11-06")?.carbHit).toBe(false);
    expect(b.days.find((d) => d.date === "2026-11-06")?.proteinHit).toBe(true);
  });
  it("ignores unlogged days and stays calm when macros are inside the band", () => {
    const w = analyzeWindow({
      "2026-11-08": [food(1, rest.kcal, rest.pMin, rest.cMin + 5, rest.f - 4)],
    }, "2026-11-08", pr);
    const b = weekBalance(w);
    expect(b.logged).toBe(1);
    expect(b.fatOverG).toBe(0);
    expect(b.carbShortG).toBe(0);
    expect(b.offset).toBe("无明显对冲");
    expect(b.badge).toBe("平衡");
    expect(b.bar).toBe("ok");
    expect(b.reason).toBe("热量缺口 −0 kcal");
    expect(b.warn).toBe("");
    expect(b.pTone).toBe("ok");
    expect(b.cTone).toBe("ok");
    expect(b.fTone).toBe("ok");
    expect(b.kcalNet).toBe(0);
  });
  it("keeps a calorie deficit green and flags protein or displaced carbs in orange", () => {
    const over = weekBalance(analyzeWindow({
      "2026-11-06": [food(1, Math.round(train.kcal * 1.2), train.pMin, train.cMin, train.f)],
    }, "2026-11-06", pr));
    expect(over.badge).toBe("偏高");
    expect(over.bar).toBe("high");
    expect(over.reason).toContain("超出 +");
    const lean = weekBalance(analyzeWindow({
      "2026-11-06": [food(2, train.kcal - 400, train.pMin, train.cMin, train.f)],
    }, "2026-11-06", pr));
    expect(lean.badge).toBe("平衡");
    expect(lean.bar).toBe("ok");
    expect(lean.reason).toBe("热量缺口 −400 kcal");
    expect(lean.reason).not.toContain("偏低");
    const lowP = weekBalance(analyzeWindow({
      "2026-11-06": [food(3, train.kcal - 200, train.pMin - 40, train.cMin, train.f)],
    }, "2026-11-06", pr));
    expect(lowP.badge).toBe("平衡");
    expect(lowP.bar).toBe("ok");
    expect(lowP.pTone).toBe("low");
    expect(lowP.warn).toBe("");
    expect(lowP.reason).not.toContain("偏低");
  });
});

describe("natural week", () => {
  const pr = PROFILE_DEFAULT;
  const train = calcTargets(pr, true);
  const rest = calcTargets(pr, false);
  const food = (id: number, k: number, p: number, c: number, f: number): Entry => ({ id, meal: "午餐", name: "a", grams: 100, k, p, c, f });
  it("starts on Monday and ends on Sunday, including a Sunday boundary", () => {
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(weekday("2026-11-09")).toBe(1);
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(weekday("2026-11-15")).toBe(0);
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    const days = weekDates("2026-11-09");
    expect(days).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(days.map(weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
  it("leaves future days out of the target and still counts elapsed days without a log", () => {
    const w = analyzeDates({
      "2026-11-09": [food(1, train.kcal - 100, train.pMin, train.cMin, train.f)],
      "2026-11-14": [food(2, rest.kcal, rest.pMin, rest.cMin, rest.f)],
    }, weekDates("2026-11-09"), pr);
    const mid = weekBalance(w, "2026-11-11");
    expect(mid.days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(mid.partial).toBe(true);
    expect(mid.kcalTarget).toBe(train.kcal * 3);
    expect(mid.kcalActual).toBe(train.kcal - 100);
    expect(mid.pMin).toBe(train.pMin * 3);
    expect(mid.logged).toBe(1);
    const done = weekBalance(w, "2026-11-16");
    expect(done.partial).toBe(false);
    expect(done.days.every((d) => !d.future)).toBe(true);
    expect(done.kcalTarget).toBe(train.kcal * 5 + rest.kcal * 2);
    expect(done.kcalActual).toBe(train.kcal - 100 + rest.kcal);
    expect(done.logged).toBe(2);
  });
});

describe("service worker", () => {
  it("bumps the cache to ct-v44", () => {
    expect(readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8")).toContain('const C = "ct-v44"');
  });
});
