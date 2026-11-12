import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode, ChangeEvent } from "react";
export { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState };
export type { ReactNode, ChangeEvent, CSSProperties, KeyboardEvent, MouseEvent } from "react";

const dark = true;
const ts = (s: string) => ({ fontSize: s, lineHeight: "1.4", letterSpacing: "0" });
const theme = {
  kind: dark ? "dark" : "light",
  bg: dark ? { base: "#0b0b0b", subtle: "#161616", elevated: "#121212" } : { base: "#ffffff", subtle: "#f6f7f9", elevated: "#ffffff" },
  text: dark
    ? { primary: "#f2f3f5", secondary: "#b4b7bd", tertiary: "#8a8e96", onColor: "#fff", onPrimary: "#111", accent: "#5aa2ff", success: "#3ccf7a", warning: "#f0a33a", danger: "#ff6b6b", accentDeep: "#5aa2ff", successDeep: "#3ccf7a", warningDeep: "#f0a33a", dangerDeep: "#ff6b6b" }
    : { primary: "#15171a", secondary: "#4b5058", tertiary: "#80858d", onColor: "#fff", onPrimary: "#fff", accent: "#1d6fe0", success: "#1a8f4c", warning: "#b86e00", danger: "#d93636", accentDeep: "#1d6fe0", successDeep: "#1a8f4c", warningDeep: "#b86e00", dangerDeep: "#d93636" },
  fill: dark
    ? { primary: "#f2f3f5", primaryHover: "#ddd", secondary: "#1f1f1f", secondaryHover: "#2a2a2a", hover: "#1c1c1c", pressed: "#2e3035", accent: "#5aa2ff", controlChecked: "#5aa2ff", accentSubtle: "#1d2a3d", successSubtle: "#16301f", warningSubtle: "#3a2a12", dangerSubtle: "#3a1a1a" }
    : { primary: "#15171a", primaryHover: "#333", secondary: "#eceef1", secondaryHover: "#e2e4e8", hover: "#f2f3f5", pressed: "#e6e8eb", accent: "#1d6fe0", controlChecked: "#1d6fe0", accentSubtle: "#e8f1fd", successSubtle: "#e6f6ec", warningSubtle: "#fdf2e1", dangerSubtle: "#fde9e9" },
  border: dark ? { subtle: "#24262a", weak: "#2c2e33", default: "#34373c", strong: "#4a4e55", focus: "#5aa2ff" } : { subtle: "#eef0f2", weak: "#e6e8eb", default: "#dcdfe3", strong: "#b9bec5", focus: "#1d6fe0" },
  font: { family: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif', mono: "ui-monospace, Menlo, monospace", heading1: ts("26px"), heading2: ts("19px"), heading3: ts("16px"), body1: ts("16px"), subtext: ts("14px"), table: ts("14px"), metric: ts("24px"), body2: ts("15px"), label: ts("13px"), caption: ts("12px"), code: ts("13px") },
  weight: { regular: 400, medium: 500, semibold: 600 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  motion: { hover: "120ms", easing: "ease" },
  dataviz: { categorical: ["#2f7cf6", "#f2b01e", "#1fb5c9"], other: "#9aa0a8", negative: "#e5484d", singleSeriesRest: "#a9c6f7", areaAlpha: "33", bandAlpha: "22", blueTint: "#e8f1fd", blue5: "#2f7cf6", sequential: [], diverging: [] },
};
export function useGrokTheme() { return theme; }
const T = theme;
const card = { border: `1px solid ${T.border.default}`, borderRadius: 16, padding: 16, background: T.bg.base, boxSizing: "border-box" as const, minWidth: 0 };

export function Page({ title, summary, action, children }: { title: string; summary?: string; width?: string; lang?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "calc(12px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) 0 calc(14px + env(safe-area-inset-left))", boxSizing: "border-box", fontFamily: T.font.family, color: T.text.primary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 6px", minHeight: 44 }}>
        <h1 style={{ fontSize: 24, margin: 0, flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h1>
        {action && <div style={{ flex: "none" }}>{action}</div>}
      </div>
      {summary && <p style={{ color: T.text.secondary, margin: "0 0 12px", fontSize: 14 }}>{summary}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
    </div>
  );
}
export function Section({ heading, children }: { heading?: string; children?: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      {heading && <h2 style={{ fontSize: 19, margin: 0 }}>{heading}</h2>}
      {children}
    </section>
  );
}
export function Text({ children }: { children?: ReactNode }) { return <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: T.text.primary }}>{children}</p>; }
export function Grid({ columns = 2, plain, children }: { columns?: number; plain?: boolean; joined?: boolean; children?: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${columns >= 3 ? 140 : 150}px, 1fr))`, gap: 12, ...(plain ? {} : {}) }}>{children}</div>;
}
export function Select<V extends string>({ label, options, value, onChange }: { label?: string; options: (V | { value: V; label: string })[]; value: V; onChange: (v: V) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {label && <span style={{ color: T.text.secondary, fontSize: 13 }}>{label}</span>}
      <select value={value} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as V)} style={{ minHeight: 44, padding: "8px 10px", borderRadius: 10, border: `1px solid ${T.border.default}`, background: T.bg.base, color: T.text.primary, fontSize: 16, width: "100%" }}>
        {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
export function Toggle({ label, value, onChange }: { label?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 15, cursor: "pointer" }}>
      <input type="checkbox" checked={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} style={{ width: 22, height: 22 }} />
      <span>{label}</span>
    </label>
  );
}
export function Input({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <label><span>{label}</span><input value={value} placeholder={placeholder} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} /></label>;
}
export function Button({ label, onClick }: { label: string; onClick: () => void; variant?: string }) { return <button onClick={onClick}>{label}</button>; }
export function Segmented<V extends string>({ options, value, onChange }: { options: (V | { value: V; label: string })[]; value: V; onChange: (v: V) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: T.fill.secondary, padding: 4, borderRadius: 12, alignSelf: "flex-start" }}>
      {options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; const on = v === value;
        return <button key={v} type="button" onClick={() => onChange(v)} style={{ minHeight: 40, padding: "0 16px", border: "none", borderRadius: 9, background: on ? T.bg.base : "transparent", color: on ? T.text.primary : T.text.secondary, fontWeight: on ? 600 : 400, fontSize: 15, cursor: "pointer" }}>{l}</button>; })}
    </div>
  );
}
type Row = { lead?: string; title: string; detail?: string; meta?: string };
export function Rows({ rows }: { rows: Row[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 10, justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 15 }}>{r.title}</div>{r.detail && <div style={{ color: T.text.secondary, fontSize: 14, marginTop: 2 }}>{r.detail}</div>}</div>
          {r.meta && <div style={{ color: T.text.secondary, fontSize: 14, whiteSpace: "nowrap" }}>{r.meta}</div>}
        </div>
      ))}
    </div>
  );
}
export function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr>{columns.map((c, i) => <th key={i} style={{ textAlign: i ? "right" : "left", padding: "8px 6px", color: T.text.secondary, fontWeight: 500, borderBottom: `1px solid ${T.border.default}` }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: j ? "right" : "left", padding: "8px 6px", borderBottom: `1px solid ${T.border.subtle}` }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export function Properties({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <div>{items.map((it, i) => <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border.subtle}` }}><div style={{ fontWeight: 600, fontSize: 15 }}>{it.label}</div><div style={{ color: T.text.secondary, fontSize: 14, marginTop: 3, lineHeight: 1.6 }}>{it.value}</div></div>)}</div>;
}
export function Callout({ lead, children }: { lead?: string; tone?: string; children?: ReactNode }) {
  return <div style={{ background: T.fill.accentSubtle, borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 1.6 }}>{lead && <strong style={{ display: "block", marginBottom: 4 }}>{lead}</strong>}{children}</div>;
}
export function NumberedList({ items }: { items: ReactNode[] }) {
  return <ol style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8, fontSize: 15, lineHeight: 1.6 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ol>;
}
export function Steps({ steps }: { steps: { title: ReactNode; detail?: ReactNode }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: "0 0 26px", height: 26, borderRadius: 13, background: T.fill.secondary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{i + 1}</div>
          <div><div style={{ fontWeight: 600, fontSize: 15 }}>{s.title}</div>{s.detail && <div style={{ color: T.text.secondary, fontSize: 14, lineHeight: 1.6 }}>{s.detail}</div>}</div>
        </div>
      ))}
    </div>
  );
}
export function Floating({ children }: { edge?: string; bar?: boolean; children?: ReactNode }) {
  return <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: T.bg.elevated, borderTop: `1px solid ${T.border.default}`, padding: "6px 8px calc(6px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>{children}</div>;
}
export function ColumnSeries({ labels, series, reference, references }: { labels: string[]; series: { name: string; values: number[] }[]; reference?: { value: number; label: string }; references?: { value: number; label: string }[] }) {
  const refs = references && references.length ? references : reference ? [reference] : [];
  const vals = series[0].values; const max = Math.max(1, ...refs.map((r) => r.value * 1.15), ...vals); const W = 340, H = 180, pb = 22, pt = 8;
  const bw = (W - 10) / labels.length;
  const y = (v: number) => pt + (H - pb - pt) * (1 - v / max);
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: T.text.secondary, marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: T.dataviz.categorical[0], marginRight: 6 }} />{series[0].name}</span>
        {refs.map((r, ri) => <span key={ri}><span style={{ display: "inline-block", width: 14, height: 0, borderTop: `2px dashed ${ri ? T.dataviz.categorical[1] : T.dataviz.other}`, marginRight: 6, verticalAlign: "middle" }} />{r.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {vals.map((v, i) => <g key={i}><rect x={5 + i * bw + bw * 0.18} y={y(v)} width={bw * 0.64} height={H - pb - y(v)} rx="3" fill={T.dataviz.categorical[0]} />{v > 0 && <text x={5 + i * bw + bw / 2} y={Math.max(12, y(v) - 3)} fontSize="10" textAnchor="middle" fill={T.text.secondary}>{v}</text>}<text x={5 + i * bw + bw / 2} y={H - 6} fontSize="10" textAnchor="middle" fill={T.text.tertiary}>{labels[i]}</text></g>)}
        {refs.map((r, ri) => <line key={ri} x1="0" x2={W} y1={y(r.value)} y2={y(r.value)} stroke={ri ? T.dataviz.categorical[1] : T.dataviz.other} strokeDasharray="4 3" />)}
      </svg>
    </div>
  );
}
export function WeekBars({ days }: { days: { label: string; sub: string; kcal: number | null; target: number; status: "未记录" | "未超标" | "超出" }[] }) {
  const W = 340, H = 210, pl = 42, pr = 8, pt = 22, pb = 36;
  const max = Math.max(1, ...days.map((d) => Math.max(d.target || 0, d.kcal || 0))) * 1.18;
  const y = (v: number) => pt + (H - pb - pt) * (1 - v / max);
  const slot = (W - pl - pr) / Math.max(1, days.length);
  const ticks = [0, max / 2, max];
  const fill = (s: string) => s === "超出" ? "#ff453a" : "#ff9f0a";
  const cxOf = (i: number) => pl + i * slot + slot / 2;
  return (
    <div style={{ ...card, background: "#141416", padding: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: T.text.secondary, marginBottom: 6 }}>
        <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#ff9f0a", marginRight: 6 }} />未超标</span>
        <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#ff453a", marginRight: 6 }} />超出</span>
        <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#3a3a3c", marginRight: 6 }} />未记录</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="近7天每日热量。白线是当天热量目标，训练日和休息日各自不同">
        {ticks.map((v, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="#2c2c2e" /><text x={pl - 4} y={y(v) + 3} fontSize="10" textAnchor="end" fill="#8e8e93">{Math.round(v)}</text></g>)}
        {days.length > 0 && <path d={days.map((d, i) => { const cx = cxOf(i); const yy = y(d.target); const half = slot * 0.42; if (i === 0) return `M ${cx - half} ${yy} H ${cx + half}`; const prev = y(days[i - 1].target); const mid = pl + (i - 0.5) * slot + slot / 2; return `M ${mid} ${prev} V ${yy} H ${cx + half}`; }).join(" ")} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />}
        {days.map((d, i) => i > 0 && days[i - 1].target === d.target ? null : <text key={`goal-${i}`} x={cxOf(i)} y={Math.max(11, y(d.target) - 5)} fontSize="8" textAnchor="start" fill="#fff">{`目标 ${Math.round(d.target)}`}</text>)}
        {days.map((d, i) => {
          const x = pl + i * slot + slot * 0.18;
          const bw = slot * 0.64;
          if (d.status === "未记录" || d.kcal == null) {
            return <g key={i}><text x={x + bw / 2} y={y(0) - 8} fontSize="9" textAnchor="middle" fill="#8e8e93">未记录</text><text x={x + bw / 2} y={H - 18} fontSize="10" textAnchor="middle" fill="#8e8e93">{d.label}</text><text x={x + bw / 2} y={H - 6} fontSize="9" textAnchor="middle" fill="#636366">{d.sub}</text></g>;
          }
          return <g key={i}><rect x={x} y={y(d.kcal)} width={bw} height={Math.max(0, y(0) - y(d.kcal))} rx="4" fill={fill(d.status)} /><text x={x + bw / 2} y={Math.max(14, y(Math.max(d.kcal, d.target)) - 4)} fontSize="10" textAnchor="middle" fill="#fff">{d.kcal}</text><text x={x + bw / 2} y={H - 18} fontSize="10" textAnchor="middle" fill="#d1d1d6">{d.label}</text><text x={x + bw / 2} y={H - 6} fontSize="9" textAnchor="middle" fill="#8e8e93">{d.sub}</text></g>;
        })}
      </svg>
      <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.4, color: "#8e8e93" }}>白线是当天热量目标，数字标在每一段旁边。训练日和休息日不一样，所以线会阶梯变化。蛋白和碳水是区间，不画在这张热量图上。</p>
    </div>
  );
}
export function LineChart({ points, ceiling, floor = 0, unit, labels }: { points: { label: string; value: number }[]; ceiling: number; floor?: number; unit?: string; labels?: [string, string?] }) {
  const W = 340, H = 180, pl = 30, pb = 22, pt = 10, pr = 10;
  const x = (i: number) => pl + (W - pl - pr) * (points.length > 1 ? i / (points.length - 1) : 0.5);
  const y = (v: number) => pt + (H - pb - pt) * (1 - (v - floor) / Math.max(0.001, ceiling - floor));
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: T.text.secondary, marginBottom: 8 }}>{labels?.[0]}{unit ? `（${unit}）` : ""}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {[floor, (floor + ceiling) / 2, ceiling].map((v, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={T.border.subtle} /><text x={pl - 4} y={y(v) + 3} fontSize="10" textAnchor="end" fill={T.text.tertiary}>{Math.round(v * 10) / 10}</text></g>)}
        <path d={d} fill="none" stroke={T.dataviz.categorical[0]} strokeWidth="2" />
        {points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.value)} r="3" fill={T.dataviz.categorical[0]} />{p.label && <text x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill={T.text.tertiary}>{p.label}</text>}</g>)}
      </svg>
    </div>
  );
}
