import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  const base =
    variant === 'secondary'
      ? 'btn secondary'
      : variant === 'ghost'
        ? 'btn ghost'
        : variant === 'accent'
          ? 'btn accent'
          : 'btn'
  return <button {...rest} className={`${base} ${className}`.trim()} />
}
