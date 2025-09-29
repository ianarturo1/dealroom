import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function TextareaComponent(
  { className = '', ...props },
  ref
) {
  return <textarea {...props} ref={ref} className={`textarea ${className}`.trim()} />
})
