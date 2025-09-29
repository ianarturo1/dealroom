import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Toolbar({ children, className = '', style }: Props) {
  return (
    <div className={`toolbar ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}
