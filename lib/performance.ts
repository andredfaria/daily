/**
 * Utilitários para monitorar performance de queries
 */

/**
 * Mede o tempo de execução de uma query e loga o resultado
 * @param queryName - Nome da query para identificação
 * @param queryFn - Função assíncrona que executa a query
 * @returns Resultado da query
 */
export async function measureQueryTime<T>(
    queryName: string,
    queryFn: () => Promise<T>
): Promise<T> {
    const start = performance.now()

    try {
        const result = await queryFn()
        const duration = performance.now() - start

        // Log apenas em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Query] ${queryName} took ${duration.toFixed(2)}ms`)
        }

        return result
    } catch (error) {
        const duration = performance.now() - start
        console.error(`[Query] ${queryName} failed after ${duration.toFixed(2)}ms`, error)
        throw error
    }
}

/**
 * Decorator para medir performance de funções
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    name?: string
): T {
    const functionName = name || fn.name || 'anonymous'

    return (async (...args: unknown[]) => {
        return measureQueryTime(functionName, () => fn(...args))
    }) as T
}
