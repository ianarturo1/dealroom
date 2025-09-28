import type { ReactNode } from "react"

interface FieldProps {
  label: string
  children: ReactNode
  className?: string
}

export function Field({ label, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
    </div>
  )
}
