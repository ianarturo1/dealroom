import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, Props>(function SelectComponent(
  { className = '', ...props },
  ref
) {
  return <select {...props} ref={ref} className={`select ${className}`.trim()} />
})
