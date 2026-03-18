import { MouseEvent, useCallback, useRef, useState } from 'react'
type DateLike = { date: string }

type HoverState<T extends DateLike> = {
  day: T
  rect: { top: number; left: number; right: number; width: number; height: number }
  container: { top: number; left: number; width: number; height: number }
}

export function useHeatmapHover<T extends DateLike>() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState<HoverState<T> | null>(null)

  const bindHover = useCallback((day: T) => {
    return {
      onMouseEnter: (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const container = containerRef.current?.getBoundingClientRect()
        if (!container) return
        setHovered({
          day,
          rect: {
            top: rect.top - container.top,
            left: rect.left - container.left,
            right: rect.right - container.left,
            width: rect.width,
            height: rect.height,
          },
          container: { top: 0, left: 0, width: container.width, height: container.height },
        })
      },
      onMouseMove: (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const container = containerRef.current?.getBoundingClientRect()
        if (!container) return
        setHovered({
          day,
          rect: {
            top: rect.top - container.top,
            left: rect.left - container.left,
            right: rect.right - container.left,
            width: rect.width,
            height: rect.height,
          },
          container: { top: 0, left: 0, width: container.width, height: container.height },
        })
      },
      onMouseLeave: () => setHovered((current) => (current?.day.date === day.date ? null : current)),
    }
  }, [])

  return { containerRef, hovered, bindHover }
}
