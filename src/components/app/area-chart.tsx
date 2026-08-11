"use client"

import { useCallback, useId, useMemo, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The performance chart — plain SVG, no charting dependency.
 *
 * Geometry is the one place a money string legitimately becomes a number: pixel
 * positions need arithmetic. The number is used **only** to place the line;
 * every figure shown to the user is formatted from the original string, so a
 * value too large for a double still reads exactly even if its dot is a pixel
 * off.
 */

export interface AreaChartPoint {
  /** `YYYY-MM-DD` */
  date: string
  /** Decimal string. */
  value: string
}

const PADDING = { top: 16, right: 16, bottom: 28, left: 16 }

export function AreaChart({
  points,
  height = 260,
  loading = false,
  className,
}: {
  points: AreaChartPoint[]
  height?: number
  loading?: boolean
  className?: string
}) {
  const gradientId = useId()
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)

  // Measure rather than rely on a scaled viewBox: `preserveAspectRatio="none"`
  // would stretch the stroke into different thicknesses horizontally and
  // vertically as the container changes shape.
  //
  // A ref callback rather than an effect, because this component returns the
  // skeleton *before* this node exists. An effect with `[]` deps would run once
  // against a null ref, bail out, and never re-attach when the real chart
  // mounted — leaving the width at 0 and drawing nothing at all.
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const geometry = useMemo(() => {
    if (width === 0 || points.length === 0) return null

    const values = points.map((point) => Number(point.value) || 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    // A dead-flat series would divide by zero; give it a band so the line
    // renders through the middle instead of collapsing onto an edge.
    const span = max - min || Math.abs(max) || 1

    const innerWidth = Math.max(width - PADDING.left - PADDING.right, 1)
    const innerHeight = Math.max(height - PADDING.top - PADDING.bottom, 1)

    const coords = values.map((value, index) => {
      const ratio = points.length === 1 ? 0.5 : index / (points.length - 1)
      return {
        x: PADDING.left + ratio * innerWidth,
        y: PADDING.top + (1 - (value - min) / span) * innerHeight,
      }
    })

    const line = coords
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ")

    const baseline = PADDING.top + innerHeight
    const first = coords[0]!
    const last = coords.at(-1)!
    const area = `${line} L${last.x},${baseline} L${first.x},${baseline} Z`

    return { coords, line, area, min, max }
  }, [points, width, height])

  const handleMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!geometry) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - bounds.left

      let nearest = 0
      let shortest = Infinity
      geometry.coords.forEach((point, index) => {
        const distance = Math.abs(point.x - x)
        if (distance < shortest) {
          shortest = distance
          nearest = index
        }
      })
      setHovered(nearest)
    },
    [geometry]
  )

  if (loading) {
    return <Skeleton className={cn("w-full rounded-xl", className)} style={{ height }} />
  }

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-secondary-200 bg-secondary-50/50 text-sm text-secondary-500",
          className
        )}
        style={{ height }}
      >
        No performance history yet.
      </div>
    )
  }

  const active = hovered !== null ? points[hovered] : null
  const activeCoord = hovered !== null ? geometry?.coords[hovered] : null

  return (
    <div ref={measureRef} className={cn("relative w-full", className)}>
      <svg
        width={width || undefined}
        height={height}
        className="w-full overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHovered(null)}
        role="img"
        aria-label={`Portfolio value over time, ${points.length} points from ${formatDate(points[0]?.date)} to ${formatDate(points.at(-1)?.date)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {geometry && (
          <>
            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path
              d={geometry.line}
              fill="none"
              stroke="var(--color-primary-600)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {activeCoord && (
              <>
                <line
                  x1={activeCoord.x}
                  y1={PADDING.top}
                  x2={activeCoord.x}
                  y2={height - PADDING.bottom}
                  stroke="var(--color-secondary-300)"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={5}
                  fill="white"
                  stroke="var(--color-primary-600)"
                  strokeWidth={2.5}
                />
              </>
            )}
          </>
        )}
      </svg>

      <div className="mt-1 flex justify-between px-1 text-[11px] text-secondary-400">
        <span>{formatDate(points[0]?.date)}</span>
        {points.length > 1 && <span>{formatDate(points.at(-1)?.date)}</span>}
      </div>

      {active && activeCoord && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-secondary-200 bg-white px-3 py-2 text-center shadow-lg"
          style={{
            left: Math.min(Math.max(activeCoord.x, 64), Math.max(width - 64, 64)),
            top: Math.max(activeCoord.y - 62, 0),
          }}
        >
          <p className="text-sm font-bold text-secondary-900 tabular">
            {formatMoney(active.value)}
          </p>
          <p className="text-[11px] text-secondary-500">{formatDate(active.date)}</p>
        </div>
      )}
    </div>
  )
}
