import type { ReactNode } from "react"

interface FieldProps {
  label: string
  children: ReactNode
  helpText?: ReactNode
}

export function Field({ label, children, helpText }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="label">{label}</span>
      {children}
      {helpText && (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{helpText}</span>
      )}
    </label>
  )
}
