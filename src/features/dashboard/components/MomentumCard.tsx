import { Activity } from 'lucide-react'

type MomentumCardProps = {
  streak?: number
  momentum?: number
  sparklineData?: number[]
}

export default function MomentumCard({
  streak = 0,
  momentum = 0,
  sparklineData = [62, 70, 75, 68, 82, 88, 87],
}: MomentumCardProps) {
  const normalizedSparkline =
    sparklineData.length > 1
      ? sparklineData
      : [sparklineData[0] ?? momentum, sparklineData[0] ?? momentum]
  const width = 120
  const height = 32
  const padding = 2
  const max = Math.max(...normalizedSparkline)
  const min = Math.min(...normalizedSparkline)
  const range = max - min || 1

  const points = normalizedSparkline.map((value, index) => {
    const x = padding + (index / (normalizedSparkline.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (value - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return (
    <div className="surface-1 border border-subtle rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h3 className="text-[14px] font-semibold text-primary-content">Momentum</h3>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-emerald-400">{momentum}</span>
            <span className="text-[13px] text-secondary-content">/ 100</span>
          </div>
          <p className="text-[12px] text-secondary-content mt-2 leading-relaxed max-w-[200px]">
            {streak > 0
              ? `Alcohol-free streak: ${streak} day${streak === 1 ? '' : 's'}.`
              : "Strong consistency — you're building real momentum this week."}
          </p>
        </div>

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
  )
}
