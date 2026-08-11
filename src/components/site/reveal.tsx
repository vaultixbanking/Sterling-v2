"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number
  y?: number
}

/**
 * Scroll-into-view fade-up wrapper. Fires once when the element is ~80px from
 * entering the viewport, so sections animate as you reach them rather than
 * finishing off-screen the way a mount-triggered animation would.
 */
export function Reveal({ children, delay = 0, y = 22, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.6, 0.35, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
