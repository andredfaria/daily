/**
 * Configuração global do SWR para cache client-side
 * Usado em componentes que precisam de revalidação automática
 */
export const swrConfig = {
    // Não revalidar quando a janela recebe foco
    revalidateOnFocus: false,

    // Revalidar quando reconectar à internet
    revalidateOnReconnect: true,

    // Intervalo de deduplicação (evita requisições duplicadas)
    dedupingInterval: 5000,

    // Throttle de revalidação ao focar
    focusThrottleInterval: 10000,

    // Número de tentativas em caso de erro
    errorRetryCount: 3,

    // Intervalo entre tentativas de retry
    errorRetryInterval: 5000,

    // Manter dados anteriores durante revalidação
    keepPreviousData: true,
}
