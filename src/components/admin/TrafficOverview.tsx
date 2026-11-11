import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Eye, Users, MousePointerClick, Timer, LogOut, Radio, RefreshCw, Globe2, FileText, Share2, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = { value: string; views: number; visitors: number };
type Totals = { views: number; visitors: number; sessions: number; bounces: number; duration: number };
type Traffic = {
  range: string; granularity: "hour" | "day" | "month"; activeNow: number;
  current: Totals; previous: Totals; series: { t: string; views: number; visitors: number }[];
  pages: Row[]; countries: Row[]; devices: Row[]; browsers: Row[]; sources: Row[];
};

const RANGES = [
  { id: "24h", label: "24 hours" }, { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" }, { id: "1y", label: "12 months" },
];

const PAGE_NAMES: Record<string, string> = {
  "/": "Home page", "/dashboard": "Dashboard", "/login": "Sign in", "/signup": "Sign up",
  "/contact": "Contact", "/legal": "Legal", "/forgot-password": "Forgot password", "/reset-password": "Reset password",
};
const pageName = (p: string) => PAGE_NAMES[p] || (p.startsWith("/business/") ? `Business · ${p.slice(10)}`
  : p.startsWith("/embed/business/") ? `Embedded booking · ${p.slice(16)}` : p.startsWith("/board/") ? `Public board · ${p.slice(7)}` : p);

const regionNames = typeof Intl !== "undefined" && (Intl as any).DisplayNames ? new (Intl as any).DisplayNames(["en"], { type: "region" }) : null;
const flag = (cc: string) => cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0))) : "🌐";
const countryName = (cc: string) => { try { return cc === "??" ? "Unknown" : regionNames?.of(cc) || cc; } catch { return cc; } };

const fmtDuration = (s: number) => { s = Math.round(s); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const delta = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0);

const DEVICE_COLORS = ["hsl(var(--primary))", "hsl(142 92% 37%)", "hsl(9 100% 60%)", "hsl(var(--muted-foreground))"];

function Kpi({ icon: Icon, label, value, change, invert, active, onClick }: {
  icon: any; label: string; value: string; change?: number; invert?: boolean; active?: boolean; onClick?: () => void;
}) {
  const good = change === undefined ? null : invert ? change <= 0 : change >= 0;
  return (
    <button onClick={onClick} disabled={!onClick}
      className={cn("text-left rounded-xl border p-4 transition-colors duration-200",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40", !onClick && "cursor-default")}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {change !== undefined && (
        <div className={cn("mt-1 text-xs font-medium", good ? "text-[hsl(142_92%_37%)]" : "text-destructive")}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% <span className="text-muted-foreground font-normal">vs previous</span>
        </div>
      )}
    </button>
  );
}

function BarList({ title, icon: Icon, rows, label, total }: { title: string; icon: any; rows: Row[]; label: (v: string) => React.ReactNode; total: number }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</h3>
        <span className="text-xs text-muted-foreground">Visitors</span>
      </div>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No data yet</p> : (
        <ul className="space-y-1.5">
          {rows.map(r => (
            <li key={r.value} className="relative flex items-center justify-between overflow-hidden rounded-md px-3 py-2 text-sm">
              <div className="absolute inset-y-0 left-0 rounded-md bg-primary/10" style={{ width: `${Math.max(pct(r.visitors, total), 2)}%` }} />
              <span className="relative truncate pr-3 text-foreground">{label(r.value)}</span>
              <span className="relative tabular-nums font-medium text-foreground">{r.visitors.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TrafficOverview() {
  const [range, setRange] = useState("7d");
  const [metric, setMetric] = useState<"visitors" | "views">("visitors");
  const [data, setData] = useState<Traffic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (r = range) => {
    setLoading(true); setError("");
    const { data: d, error: e } = await supabase.functions.invoke("admin-panel-data", { body: { type: "traffic", dateRange: r } });
    if (e || !d || d.error) setError("Couldn't load visitor statistics. Try again."); else setData(d as Traffic);
    setLoading(false);
  };
  useEffect(() => { load(range); }, [range]);

  const chart = useMemo(() => (data?.series || []).map(s => {
    const d = new Date(s.t);
    const label = data?.granularity === "hour" ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : data?.granularity === "month" ? d.toLocaleDateString([], { month: "short", year: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
    return { ...s, label };
  }), [data]);

  const c = data?.current, p = data?.previous;
  const bounce = c ? pct(c.bounces, c.sessions) : 0, pBounce = p ? pct(p.bounces, p.sessions) : 0;
  const avg = c && c.sessions ? c.duration / c.sessions : 0, pAvg = p && p.sessions ? p.duration / p.sessions : 0;
  const totalVisitors = Math.max(c?.visitors || 0, 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                range === r.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-foreground">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(142_92%_37%)] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(142_92%_37%)]" /></span>
            <Radio className="h-3.5 w-3.5 text-muted-foreground" />{data?.activeNow ?? 0} online now
          </span>
          <Button variant="outline" size="icon" onClick={() => load()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card className="overflow-hidden">
        <div className={cn("grid grid-cols-2 gap-3 p-4 lg:grid-cols-5 transition-opacity duration-200", loading && "opacity-60")}>
          <Kpi icon={Users} label="Unique visitors" value={(c?.visitors ?? 0).toLocaleString()} change={c && p ? delta(c.visitors, p.visitors) : undefined}
            active={metric === "visitors"} onClick={() => setMetric("visitors")} />
          <Kpi icon={Eye} label="Page views" value={(c?.views ?? 0).toLocaleString()} change={c && p ? delta(c.views, p.views) : undefined}
            active={metric === "views"} onClick={() => setMetric("views")} />
          <Kpi icon={MousePointerClick} label="Pages per visit" value={c && c.sessions ? (c.views / c.sessions).toFixed(1) : "0"}
            change={c && p && p.sessions ? delta(c.views / (c.sessions || 1), p.views / p.sessions) : undefined} />
          <Kpi icon={Timer} label="Avg. visit time" value={fmtDuration(avg)} change={p ? delta(avg, pAvg) : undefined} />
          <Kpi icon={LogOut} label="Bounce rate" value={`${bounce.toFixed(0)}%`} change={p && p.sessions ? bounce - pBounce : undefined} invert />
        </div>
        <div className="h-[300px] px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--popover-foreground))" }}
                formatter={(v: number) => [v.toLocaleString(), metric === "visitors" ? "Visitors" : "Page views"]} />
              <Area type="monotone" dataKey={metric} stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#trafficFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {(range === "30d" || range === "90d" || range === "1y") && (
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">For longer periods, visitors are counted once per day, so someone who returns on two days counts twice.</p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <BarList title="Top pages" icon={FileText} rows={data?.pages || []} label={pageName} total={totalVisitors} />
        <BarList title="Countries" icon={Globe2} rows={data?.countries || []} total={totalVisitors}
          label={v => <span className="flex items-center gap-2"><span>{flag(v)}</span>{countryName(v)}</span>} />
        <BarList title="Traffic sources" icon={Share2} rows={data?.sources || []} total={totalVisitors}
          label={v => v === "direct" ? "Direct / typed in" : v} />
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Monitor className="h-4 w-4 text-primary" />Devices & browsers</h3>
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.devices || []} dataKey="visitors" nameKey="value" innerRadius={50} outerRadius={78} paddingAngle={3} isAnimationActive={false}>
                    {(data?.devices || []).map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {(data?.devices || []).map((d, i) => (
                <div key={d.value} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 capitalize text-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DEVICE_COLORS[i % 4] }} />{d.value}</span>
                  <span className="tabular-nums text-muted-foreground">{pct(d.visitors, totalVisitors).toFixed(0)}%</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-1.5">
                {(data?.browsers || []).slice(0, 4).map(b => (
                  <div key={b.value} className="flex justify-between text-xs text-muted-foreground"><span>{b.value}</span><span className="tabular-nums">{b.visitors}</span></div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
