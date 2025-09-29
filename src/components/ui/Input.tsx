import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, Props>(function InputComponent(
  { className = '', ...props },
  ref
) {
  return <input {...props} ref={ref} className={`input ${className}`.trim()} />
})
