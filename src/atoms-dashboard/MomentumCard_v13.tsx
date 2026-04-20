import { Activity } from "lucide-react";

// 7-day sparkline data (0-100 scale)
const SPARKLINE_DATA = [62, 70, 75, 68, 82, 88, 87];

export default function MomentumCard() {
  // Build SVG sparkline path
  const width = 120;
  const height = 32;
  const padding = 2;
  const max = Math.max(...SPARKLINE_DATA);
  const min = Math.min(...SPARKLINE_DATA);
  const range = max - min || 1;

  const points = SPARKLINE_DATA.map((val, i) => {
    const x = padding + (i / (SPARKLINE_DATA.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="surface-1 border border-subtle rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h3 className="text-[14px] font-semibold text-primary-content">
          Momentum
        </h3>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-emerald-400">87</span>
            <span className="text-[13px] text-secondary-content">/ 100</span>
          </div>
          <p className="text-[12px] text-secondary-content mt-2 leading-relaxed max-w-[200px]">
            Strong consistency — you're building real momentum this week.
          </p>
        </div>

        {/* Sparkline */}
        <div className="shrink-0">
          <svg width={width} height={height} className="overflow-visible">
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#sparkGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke="rgb(52, 211, 153)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Current point */}
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3"
              fill="rgb(52, 211, 153)"
            />
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="6"
              fill="rgb(52, 211, 153)"
              opacity="0.2"
            />
          </svg>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-tertiary-content">Mon</span>
            <span className="text-[8px] text-tertiary-content">Sun</span>
          </div>
        </div>
      </div>
    </div>
  );
}