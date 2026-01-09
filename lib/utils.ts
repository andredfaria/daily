import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge to resolve conflicts
 * 
 * @example
 * cn('px-4 py-2', condition && 'bg-blue-500', 'px-6') // => 'px-6 py-2 bg-blue-500'
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
