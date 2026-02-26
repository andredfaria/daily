'use client'

import { useState, useEffect } from 'react'

/**
 * Hook para detectar se o componente está montado no client.
 * Útil para evitar erros de hidratação e acesso a APIs de browser/contexto durante SSR.
 */
export function useIsMounted() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}
