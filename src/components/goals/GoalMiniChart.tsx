import { useMemo } from "react";

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export default function MiniChart({
  data,
  width = 200,
  height = 48,
  color = "#6366F1",
  fillColor = "rgba(99,102,241,0.1)",
}: MiniChartProps) {
  const pathD = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 4;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const stepX = innerW / (data.length - 1);

    const points = data.map((v, i) => ({
      x: padding + i * stepX,
      y: padding + innerH - ((v - min) / range) * innerH,
    }));

    // Smooth curve using cubic bezier
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [data, width, height]);

  const fillPathD = useMemo(() => {
    if (!pathD) return "";
    const padding = 4;
    return `${pathD} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  }, [pathD, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {/* Fill area */}
      <path d={fillPathD} fill={fillColor} />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 1 && (
        <circle
          cx={width - 4}
          cy={
            4 +
            (height - 8) -
            ((data[data.length - 1] - Math.min(...data)) /
              (Math.max(...data) - Math.min(...data) || 1)) *
              (height - 8)
          }
          r={3}
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
}