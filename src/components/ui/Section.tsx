import type { CSSProperties, ReactNode } from "react"

interface SectionProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Section({ title, actions, children, className = "", style }: SectionProps) {
  return (
    <section className={`card ${className}`.trim()} style={{ padding: 20, ...style }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="section-title h2" style={{ margin: 0 }}>
          {title}
        </div>
        {actions}
      </div>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  )
}
