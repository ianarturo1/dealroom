import type { CSSProperties, ReactNode } from 'react'

type Props = {
  label: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function FormRow({ label, children, className = '', style }: Props) {
  return (
    <div className={className} style={style}>
      <span className="label">{label}</span>
      {children}
    </div>
  )
}
