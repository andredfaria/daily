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

/**
 * Formata um número de telefone armazenado no banco (chatId com @c.us ou dígitos puros)
 * para exibição no frontend no formato +55 11 99999-9999
 *
 * @example
 * formatPhoneDisplay('5511999999999@c.us') // => '+55 11 99999-9999'
 * formatPhoneDisplay('5511999999999')       // => '+55 11 99999-9999'
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
    if (!phone) return ''
    // Remove @c.us e todos os não-dígitos
    const digits = phone.replace('@c.us', '').replace(/\D/g, '')
    // Formato Brasil com 9 dígito: +55 XX 9XXXX-XXXX (13 dígitos)
    if (digits.length === 13 && digits.startsWith('55')) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
    }
    // Formato Brasil sem 9 (8 dígitos): +55 XX XXXX-XXXX (12 dígitos)
    if (digits.length === 12 && digits.startsWith('55')) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`
    }
    // Fallback: retorna os dígitos sem formatação
    return digits
}

/**
 * Normaliza o número digitado pelo usuário para o formato chatId usado no banco: XXXXXXXXXXX@c.us
 * Remove todos os não-dígitos e adiciona @c.us
 *
 * @example
 * normalizePhoneForDB('+55 11 99999-9999') // => '5511999999999@c.us'
 */
export function normalizePhoneForDB(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    return `${digits}@c.us`
}
