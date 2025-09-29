import { forwardRef } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  style?: CSSProperties
}

export const Card = forwardRef<HTMLDivElement, Props>(function CardComponent(
  { children, className = '', style, ...rest },
  ref
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={`card ${className}`.trim()}
      style={{ padding: 16, ...style }}
    >
      {children}
    </div>
  )
})
