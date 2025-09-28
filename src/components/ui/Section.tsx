import type { CSSProperties, ReactNode } from "react"

interface SectionProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Section({ title, actions, children, className = "", style }: SectionProps) {
  const classes = ["card", className].filter(Boolean).join(" ")
  return (
    <div className={classes} style={{ padding: 20, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="section-title h2">{title}</div>
        {actions}
      </div>
      {children}
    </div>
  )
}
