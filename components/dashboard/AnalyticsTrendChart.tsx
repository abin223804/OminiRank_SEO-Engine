"use client";

import { useState, useId, useMemo } from "react";
import {
  TrendingUp,
  Eye,
  MousePointerClick,
  Percent,
  Compass,
  Calendar,
  Sparkles,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export interface SnapshotItem {
  id: string;
  startDate: string;
  endDate: string;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgPosition: number;
  totalQueries: number;
  createdAt: string;
}

interface AnalyticsTrendChartProps {
  projectId: string;
  snapshots: SnapshotItem[];
  isLoading?: boolean;
  onTriggerSync?: () => void;
  onOpenDigestModal?: () => void;
  onPingSitemap?: () => void;
}

type MetricKey = "impressions" | "clicks" | "ctr" | "position";

export function AnalyticsTrendChart({
  projectId,
  snapshots,
  isLoading,
  onTriggerSync,
  onOpenDigestModal,
  onPingSitemap,
}: AnalyticsTrendChartProps) {
  const gradientId = useId();
  const [timeRange, setTimeRange] = useState<"7D" | "14D" | "30D" | "ALL">("30D");
  const [activeMetric, setActiveMetric] = useState<MetricKey>("impressions");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Filter and sort chronologically (oldest to newest for left-to-right charting)
  const sortedSnapshots = useMemo(() => {
    const list = [...snapshots].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (timeRange === "7D") return list.slice(-7);
    if (timeRange === "14D") return list.slice(-14);
    if (timeRange === "30D") return list.slice(-30);
    return list;
  }, [snapshots, timeRange]);

  // Extract metric configurations
  const metricConfigs = {
    impressions: {
      name: "Impressions",
      icon: Eye,
      color: "#06b6d4", // Cyan
      stroke: "stroke-cyan-400",
      fillStart: "rgba(6, 182, 212, 0.4)",
      fillEnd: "rgba(6, 182, 212, 0.0)",
      formatter: (v: number) => v.toLocaleString(),
      getValue: (s: SnapshotItem) => s.totalImpressions,
      inverted: false,
    },
    clicks: {
      name: "Organic Clicks",
      icon: MousePointerClick,
      color: "#10b981", // Emerald
      stroke: "stroke-emerald-400",
      fillStart: "rgba(16, 185, 129, 0.4)",
      fillEnd: "rgba(16, 185, 129, 0.0)",
      formatter: (v: number) => v.toLocaleString(),
      getValue: (s: SnapshotItem) => s.totalClicks,
      inverted: false,
    },
    ctr: {
      name: "Average CTR",
      icon: Percent,
      color: "#f59e0b", // Amber
      stroke: "stroke-amber-400",
      fillStart: "rgba(245, 158, 11, 0.4)",
      fillEnd: "rgba(245, 158, 11, 0.0)",
      formatter: (v: number) => `${(v * 100).toFixed(1)}%`,
      getValue: (s: SnapshotItem) => s.avgCtr,
      inverted: false,
    },
    position: {
      name: "Average Position",
      icon: Compass,
      color: "#a855f7", // Violet
      stroke: "stroke-purple-400",
      fillStart: "rgba(168, 85, 247, 0.4)",
      fillEnd: "rgba(168, 85, 247, 0.0)",
      formatter: (v: number) => v.toFixed(1),
      getValue: (s: SnapshotItem) => s.avgPosition,
      inverted: true, // Lower rank is better!
    },
  };

  const currentConfig = metricConfigs[activeMetric];

  // Chart dimensions & scaling calculations
  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;

  const chartData = useMemo(() => {
    if (sortedSnapshots.length === 0) return { points: [], minVal: 0, maxVal: 0, pathD: "", areaD: "" };

    const values = sortedSnapshots.map((s) => currentConfig.getValue(s));
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    // Provide headroom
    if (minVal === maxVal) {
      minVal = Math.max(0, minVal * 0.8);
      maxVal = maxVal * 1.2 || 10;
    } else {
      const buffer = (maxVal - minVal) * 0.1;
      minVal = Math.max(0, minVal - buffer);
      maxVal = maxVal + buffer;
    }

    const availableW = width - paddingX * 2;
    const availableH = height - paddingY * 2;

    const points = sortedSnapshots.map((s, idx) => {
      const x =
        sortedSnapshots.length === 1
          ? width / 2
          : paddingX + (idx / (sortedSnapshots.length - 1)) * availableW;

      const rawVal = currentConfig.getValue(s);
      // If inverted (rank), higher value maps to lower position on screen (closer to bottom)
      const ratio = currentConfig.inverted
        ? (rawVal - minVal) / (maxVal - minVal || 1)
        : (maxVal - rawVal) / (maxVal - minVal || 1);

      const y = paddingY + ratio * availableH;

      return {
        x,
        y,
        snapshot: s,
        value: rawVal,
      };
    });

    // Build smooth monotonic cubic Bézier path
    let pathD = "";
    if (points.length === 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
    } else if (points.length > 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i < points.length - 2 ? points[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
    }

    // Area fill path
    let areaD = "";
    if (points.length > 1) {
      const bottomY = height - paddingY;
      areaD = `${pathD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
    }

    return { points, minVal, maxVal, pathD, areaD };
  }, [sortedSnapshots, currentConfig, width, height, paddingX, paddingY]);

  // Compute Delta between oldest and newest in range
  const rangeDelta = useMemo(() => {
    if (sortedSnapshots.length < 2) return null;
    const first = currentConfig.getValue(sortedSnapshots[0]);
    const last = currentConfig.getValue(sortedSnapshots[sortedSnapshots.length - 1]);
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    return {
      diff,
      pct: Math.round(pct * 10) / 10,
      improved: currentConfig.inverted ? diff < 0 : diff > 0,
    };
  }, [sortedSnapshots, currentConfig]);

  const activePoint = hoverIndex !== null && chartData.points[hoverIndex] ? chartData.points[hoverIndex] : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d]/90 overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Chart Top Header & Executive Controls */}
      <div className="p-5 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Performance Trend Intelligence
              <span className="text-[11px] font-mono font-normal text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                GSC Historical Curves
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracking impressions, organic clicks, CTR, and search rank trajectory across crawl cycles.
          </p>
        </div>

        {/* Quick Actions (Email Digest & Sitemap) */}
        <div className="flex items-center flex-wrap gap-2">
          {onOpenDigestModal && (
            <button
              onClick={onOpenDigestModal}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Preview or dispatch weekly executive email digest"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Executive Digest</span>
            </button>
          )}

          {onPingSitemap && (
            <button
              onClick={onPingSitemap}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium border border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Ping Google Search Console sitemap and trigger indexing API"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ping Google Sitemap</span>
            </button>
          )}

          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 font-mono text-[11px]">
            {(["7D", "14D", "30D", "ALL"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  timeRange === r
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="px-5 pt-3 pb-2 border-b border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(Object.keys(metricConfigs) as MetricKey[]).map((key) => {
          const cfg = metricConfigs[key];
          const Icon = cfg.icon;
          const isActive = activeMetric === key;
          const latestVal = sortedSnapshots.length
            ? cfg.getValue(sortedSnapshots[sortedSnapshots.length - 1])
            : 0;

          return (
            <button
              key={key}
              onClick={() => {
                setActiveMetric(key);
                setHoverIndex(null);
              }}
              className={`p-3 rounded-lg border text-left transition-all relative overflow-hidden ${
                isActive
                  ? "bg-slate-900/90 border-slate-700 shadow-md ring-1 ring-cyan-500/20"
                  : "bg-slate-950/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/40"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  {cfg.name}
                </span>
                {isActive && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                )}
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-white">
                {cfg.formatter(latestVal)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Chart Graphic Canvas */}
      <div className="p-5 relative">
        {isLoading ? (
          <div className="h-60 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-2">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span>Analyzing snapshot trends...</span>
          </div>
        ) : sortedSnapshots.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                No Search Console Snapshots Available
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                Run your first sync to record performance metrics and start building trend intelligence.
              </p>
            </div>
            {onTriggerSync && (
              <button
                onClick={onTriggerSync}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
              >
                Sync Now
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Top Stat Summary Banner */}
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono">
                  {currentConfig.name}:
                </span>
                <span
                  className="font-mono font-bold"
                  style={{ color: currentConfig.color }}
                >
                  {activePoint
                    ? currentConfig.formatter(activePoint.value)
                    : currentConfig.formatter(
                        currentConfig.getValue(
                          sortedSnapshots[sortedSnapshots.length - 1]
                        )
                      )}
                </span>
                {activePoint && (
                  <span className="text-[11px] font-mono text-slate-500">
                    ({new Date(activePoint.snapshot.createdAt).toLocaleDateString()})
                  </span>
                )}
              </div>

              {rangeDelta && !activePoint && (
                <div
                  className={`text-[11px] font-mono flex items-center gap-1 ${
                    rangeDelta.improved ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  <span>{rangeDelta.improved ? "▲" : "▼"}</span>
                  <span>
                    {Math.abs(rangeDelta.pct)}% across {timeRange}
                  </span>
                </div>
              )}
            </div>

            {/* SVG Visualizer */}
            <div className="w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-56 select-none overflow-visible"
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient
                    id={`grad-${gradientId}`}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={currentConfig.color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={currentConfig.color} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                {[0.2, 0.4, 0.6, 0.8].map((pct) => {
                  const y = paddingY + (height - paddingY * 2) * pct;
                  return (
                    <line
                      key={pct}
                      x1={paddingX}
                      y1={y}
                      x2={width - paddingX}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  );
                })}

                {/* Area Gradient Fill */}
                {chartData.areaD && (
                  <path d={chartData.areaD} fill={`url(#grad-${gradientId})`} />
                )}

                {/* Trend Curve Line */}
                {chartData.pathD && (
                  <path
                    d={chartData.pathD}
                    fill="none"
                    stroke={currentConfig.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover Crosshair & Circles */}
                {activePoint && (
                  <>
                    <line
                      x1={activePoint.x}
                      y1={paddingY}
                      x2={activePoint.x}
                      y2={height - paddingY}
                      stroke="#475569"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="6"
                      fill={currentConfig.color}
                      stroke="#060a12"
                      strokeWidth="2.5"
                      className="shadow-glow-cyan"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="12"
                      fill={currentConfig.color}
                      fillOpacity="0.2"
                      className="animate-ping"
                    />
                  </>
                )}

                {/* Interactive Hit Areas */}
                {chartData.points.map((pt, idx) => (
                  <rect
                    key={idx}
                    x={pt.x - (width / chartData.points.length) / 2}
                    y={0}
                    width={width / chartData.points.length}
                    height={height}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                ))}
              </svg>
            </div>

            {/* Floating Cyber Tooltip */}
            {activePoint && (
              <div
                className="absolute z-20 pointer-events-none p-2.5 rounded-lg border border-slate-700 bg-[#060a12]/95 shadow-xl text-xs font-mono space-y-1 backdrop-blur-md"
                style={{
                  left: `${Math.min(Math.max(activePoint.x / (width / 100), 10), 85)}%`,
                  top: "10px",
                  transform: "translateX(-50%)",
                }}
              >
                <div className="text-[11px] text-slate-400 border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
                  <span>Snapshot: {new Date(activePoint.snapshot.createdAt).toLocaleDateString()}</span>
                  <span className="text-cyan-400 font-bold">{activePoint.snapshot.totalQueries} Queries</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5 text-[11px]">
                  <span className="text-slate-500">Impressions:</span>
                  <span className="text-white font-semibold text-right">
                    {activePoint.snapshot.totalImpressions.toLocaleString()}
                  </span>

                  <span className="text-slate-500">Clicks:</span>
                  <span className="text-emerald-400 font-semibold text-right">
                    {activePoint.snapshot.totalClicks.toLocaleString()}
                  </span>

                  <span className="text-slate-500">Avg CTR:</span>
                  <span className="text-amber-400 font-semibold text-right">
                    {(activePoint.snapshot.avgCtr * 100).toFixed(1)}%
                  </span>

                  <span className="text-slate-500">Avg Pos:</span>
                  <span className="text-purple-400 font-semibold text-right">
                    {activePoint.snapshot.avgPosition.toFixed(1)}
                  </span>
                </div>
              </div>
            )}

            {/* X-Axis Timeline Dates */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 px-6">
              {sortedSnapshots.length > 0 && (
                <>
                  <span>
                    {new Date(sortedSnapshots[0].createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {sortedSnapshots.length > 2 && (
                    <span>
                      {new Date(
                        sortedSnapshots[Math.floor(sortedSnapshots.length / 2)].createdAt
                      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  <span>
                    {new Date(
                      sortedSnapshots[sortedSnapshots.length - 1].createdAt
                    ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
