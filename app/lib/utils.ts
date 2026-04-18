import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes with conflict-resolution.
 *
 * Use for composing conditional class strings in shadcn-style components.
 * Example:
 *   cn('px-2 py-1', condition && 'bg-accent', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
