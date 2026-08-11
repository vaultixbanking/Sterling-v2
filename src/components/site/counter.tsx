"use client"

import { useEffect, useRef, useState } from "react"
import { animate, useInView } from "framer-motion"

import { cn } from "@/lib/utils"

interface CounterProps {
  /** Target number to count up to */
  value: number
  prefix?: string
  suffix?: string
  /** Decimal places to render — useful for figures like 2.4 */
  decimals?: number
  duration?: number
  className?: string
}

/**
 * Counts up from zero the first time it scrolls into view.
 */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.8,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return

    const controls = animate(0, value, {
      duration,
      ease: [0.21, 0.6, 0.35, 1],
      onUpdate: (latest) => setDisplay(latest),
    })

    return () => controls.stop()
  }, [inView, value, duration])

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
