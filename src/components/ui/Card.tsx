import type { ReactNode, CSSProperties } from "react"

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div className={`card ${className}`.trim()} style={{ padding: 16, ...style }}>
      {children}
    </div>
  )
}
