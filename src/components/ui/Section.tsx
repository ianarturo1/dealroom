import { forwardRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Card } from './Card'

type Props = {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export const Section = forwardRef<HTMLDivElement, Props>(function SectionComponent({ title, actions, children, className = '', style }: Props, ref) {
  return (
    <Card ref={ref} className={className} style={{ padding: 20, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <div className="title h2">{title}</div>
        {actions}
      </div>
      {children}
    </Card>
  )
})
