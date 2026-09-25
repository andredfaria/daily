import pool from '../db'
import { sendWhatsAppText } from './waha'
import { fechamentoMensal } from './financialAnalytics'
import { claimMessage, releaseMessageClaimIfUndelivered, claimKeyDia, claimKeyMesAnterior } from './messageClaim'
import { formatDateSaoPaulo } from './assetMath'
import { variacaoPeriodo } from './benchmarkMath'
import { contasDaSemana } from './whatsappCommandHandler'
import { blocoCarteiraSemana, blocoChecklistsSemana, linhasContas, somarDias } from './whatsappCommands'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const NOMES_CATEGORIA: Record<string, string> = {
  moradia: 'Moradia',
  assinaturas: 'Assinaturas',
  'serviços': 'Serviços',
  'saúde': 'Saúde',
  'educação': 'Educação',
  transporte: 'Transporte',
  'alimentação': 'Alimentação',
  outro: 'Outro',
}

// --- Resumo semanal: contas da semana, carteira e checklists ---
// As datas saem de São Paulo: o container roda em UTC, e o resumo das 8h BRT
// usando new Date() pegava o mês e a semana certos só por sorte do horário.
export async function sendWeeklySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const hoje = formatDateSaoPaulo(new Date())
  const inicioDoMes = `${hoje.slice(0, 7)}-01`
  const fimDoMes = somarDias(`${proximoMes(hoje)}-01`, -1)

  const [[stats]]: any = await pool.query(
    `SELECT SUM(o.amount) AS total
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
    [userId, inicioDoMes, fimDoMes]
  )
  const proximas = await contasDaSemana(userId, hoje)

  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''
  let msg = `📊 *Resumo BillSync${firstName}*\n\n`
  msg += `*Total deste mês:* R$ ${formatBRL(Number(stats.total) || 0)}\n`

  if (proximas.length) {
    msg += `\n*Próximos 7 dias:*\n${linhasContas(proximas, hoje).join('\n')}\n`
  } else {
    msg += `\nNenhuma conta nos próximos 7 dias. 🎉\n`
  }

  // Blocos sem dado somem: quem não tem ativo não recebe uma "Carteira" vazia.
  const blocos = [await blocoCarteira(userId, hoje), await blocoChecklists(userId, hoje)].filter(Boolean)
  if (blocos.length) msg += `\n${blocos.join('\n\n')}`

  const refKey = claimKeyDia()
  if (!await claimMessage(userId, 'weekly_summary', refKey)) return

  try {
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  } catch (err) {
    await releaseMessageClaimIfUndelivered(userId, 'weekly_summary', refKey, err)
    throw err
  }
  console.log(`[summary] resumo semanal enviado para ${userId}`)
}

function proximoMes(data: string): string {
  const [ano, mes] = data.split('-').map(Number)
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`
}

// Variação dos últimos 7 dias, sem contar aporte como ganho.
async function blocoCarteira(userId: string, hoje: string): Promise<string | null> {
  const [rows]: any = await pool.query(
    `SELECT asset_id, DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS date, price, quantity
       FROM asset_snapshots
      WHERE user_id = ? AND snapshot_date >= ?`,
    [userId, somarDias(hoje, -7)]
  )
  return blocoCarteiraSemana(variacaoPeriodo(rows.map((r: any) => ({
    assetId: r.asset_id,
    date: r.date,
    price: Number(r.price),
    quantity: Number(r.quantity),
  }))))
}

// Os 7 dias fechados antes de hoje: o poll de hoje ainda nem foi respondido às 8h.
async function blocoChecklists(userId: string, hoje: string): Promise<string | null> {
  const [rows]: any = await pool.query(
    `SELECT p.checklist_id, c.name, p.completed_count, p.total_count
       FROM checklist_daily_polls p JOIN checklists c ON c.id = p.checklist_id
      WHERE p.user_id = ? AND p.poll_date BETWEEN ? AND ?`,
    [userId, somarDias(hoje, -7), somarDias(hoje, -1)]
  )
  return blocoChecklistsSemana(rows.map((r: any) => ({
    checklistId: r.checklist_id,
    nome: r.name || 'Checklist',
    completos: Number(r.completed_count) || 0,
    total: Number(r.total_count) || 0,
  })))
}

// --- Sumário mensal (novo): fechamento do mês anterior ---
export async function sendMonthlySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ano = prev.getFullYear()
  const mes = prev.getMonth() + 1

  const fechamento = await fechamentoMensal(userId, ano, mes)
  if (fechamento.qtdContas === 0) return // nada a reportar

  const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''

  let msg = `📅 *Fechamento de ${nomesMes[mes - 1]}${firstName}*\n\n`
  msg += `*Total:* R$ ${formatBRL(fechamento.total)} em ${fechamento.qtdContas} conta(s)\n`

  if (fechamento.porCategoria.length) {
    msg += `\n*Por categoria:*\n`
    for (const c of fechamento.porCategoria) {
      const nome = NOMES_CATEGORIA[c.category] ?? c.category
      msg += `• ${nome}: R$ ${formatBRL(c.total)}\n`
    }
  }

  if (fechamento.orcamento != null) {
    const diff = fechamento.total - fechamento.orcamento
    if (diff > 0) {
      msg += `\n⚠️ R$ ${formatBRL(diff)} acima do orçamento de R$ ${formatBRL(fechamento.orcamento)}.`
    } else {
      msg += `\n✅ Dentro do orçamento (R$ ${formatBRL(fechamento.orcamento)}).`
    }
  }

  const refKey = claimKeyMesAnterior()
  if (!await claimMessage(userId, 'monthly_summary', refKey)) return

  try {
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  } catch (err) {
    await releaseMessageClaimIfUndelivered(userId, 'monthly_summary', refKey, err)
    throw err
  }
  console.log(`[summary] sumário mensal enviado para ${userId}`)
}
