// Datas de São Paulo para o painel de admin. O container roda em UTC, então
// "hoje" e "mês corrente" não podem sair de CURDATE() do banco.
// O Brasil não tem horário de verão desde 2019: São Paulo é sempre UTC-3.

/** Data de São Paulo no formato AAAA-MM-DD. */
export function dataSP(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora)
}

/** Meia-noite de hoje em São Paulo, como instante (para comparar com DATETIME). */
export function inicioDoDiaSP(agora: Date = new Date()): Date {
  return new Date(`${dataSP(agora)}T00:00:00-03:00`)
}

/** Primeiro dia do mês corrente em São Paulo (AAAA-MM-01). */
export function inicioDoMesSP(agora: Date = new Date()): string {
  return `${dataSP(agora).slice(0, 7)}-01`
}

/** Primeiro dia do mês seguinte em São Paulo (AAAA-MM-01). */
export function inicioDoProximoMesSP(agora: Date = new Date()): string {
  const [a, m] = dataSP(agora).split('-').map(Number)
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
}
