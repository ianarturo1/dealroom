import type { CSSProperties, ReactNode } from "react"

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Card({ children, className = "", style }: CardProps) {
  const classes = ["card", className].filter(Boolean).join(" ")
  return (
    <div className={classes} style={{ padding: 16, ...style }}>
      {children}
    </div>
  )
}
