import type { ComponentProps } from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export function AppButton({
  className,
  variant = 'primary',
  ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'size'> & {
  variant?: 'primary' | 'ghost'
}) {
  return (
    <Button
      variant="native"
      size="plain"
      className={cn(
        'cursor-pointer rounded-[8px] border-0 px-[16px] py-[9px] font-mono text-[.8rem] font-semibold transition-[color,background,border-color,filter] duration-200 disabled:opacity-50',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:brightness-110'
          : 'border border-border bg-transparent text-muted-foreground hover:border-[var(--dim)] hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
