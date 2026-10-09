import {
  ContaParaPagar,
  acharConta,
  acharItem,
  parseComando,
  parsePaguei,
  textoAjuda,
  textoContaAmbigua,
  textoContaJaPaga,
  textoContaNaoEncontrada,
  textoContaPaga,
  textoContaSemVencimento,
  textoContas,
  textoUsoPaguei,
  textoVariavelSemValor,
} from '../whatsappCommands'

const conta = (nome: string, extra: Partial<ContaParaPagar> = {}): ContaParaPagar => ({
  billId: `id-${nome}`,
  nome,
  variavel: false,
  ...extra,
})

describe('/paguei — comando', () => {
  it('é reconhecido', () => {
    expect(parseComando('/paguei luz')).toBe('paguei')
    expect(parseComando('/PAGUEI Luz 120')).toBe('paguei')
  })
})

describe('parsePaguei', () => {
  it('só o nome', () => {
    expect(parsePaguei('luz')).toEqual({ termo: 'luz', valor: null })
    expect(parsePaguei('conta de luz')).toEqual({ termo: 'conta de luz', valor: null })
  })

  it('valor no fim ou no começo, nos formatos do /gasto', () => {
    expect(parsePaguei('luz 187,40')).toEqual({ termo: 'luz', valor: 187.4 })
    expect(parsePaguei('187,40 luz')).toEqual({ termo: 'luz', valor: 187.4 })
    expect(parsePaguei('R$ 1.234,56 conta de luz')).toEqual({ termo: 'conta de luz', valor: 1234.56 })
    expect(parsePaguei('luz R$45')).toEqual({ termo: 'luz', valor: 45 })
  })

  it('texto igual ao nome de uma conta vale inteiro', () => {
    expect(parsePaguei('iptu 2026', ['Luz', 'IPTU 2026'])).toEqual({ termo: 'iptu 2026', valor: null })
    expect(parsePaguei('iptu 2026 350', ['IPTU 2026'])).toEqual({ termo: 'iptu 2026', valor: 350 })
    expect(parsePaguei('iptu 2026')).toEqual({ termo: 'iptu', valor: 2026 })
  })

  it('sem nome ou vazio não serve', () => {
    expect(parsePaguei('')).toBeNull()
    expect(parsePaguei('   ')).toBeNull()
    expect(parsePaguei('187,40')).toBeNull()
    expect(parsePaguei('R$ 50')).toBeNull()
  })
})

describe('acharConta', () => {
  const contas = [conta('Luz'), conta('Luz da casa de praia'), conta('Água'), conta('Internet'), conta('IPTU 2026')]

  it('casa sem acento e maiúscula', () => {
    expect(acharConta(contas, 'agua')).toMatchObject({ tipo: 'achou', conta: { nome: 'Água' } })
    expect(acharConta(contas, 'INTER')).toMatchObject({ tipo: 'achou', conta: { nome: 'Internet' } })
  })

  it('nome exato ganha de trecho', () => {
    expect(acharConta(contas, 'luz')).toMatchObject({ tipo: 'achou', conta: { nome: 'Luz' } })
  })

  it('empate pede escolha', () => {
    const r = acharConta([conta('Luz casa'), conta('Luz praia')], 'luz')
    expect(r.tipo).toBe('varios')
    if (r.tipo === 'varios') expect(r.opcoes.map((c) => c.nome)).toEqual(['Luz casa', 'Luz praia'])
  })

  it('nenhuma', () => {
    expect(acharConta(contas, 'gás')).toEqual({ tipo: 'nenhum' })
    expect(acharConta(contas, '')).toEqual({ tipo: 'nenhum' })
  })

  it('não muda o /marcar', () => {
    const polls = [{ pollId: 'p1', nome: 'Manhã', itens: ['Ler', 'Ler 10 páginas', 'Academia'], marcados: ['Ler'] }]
    expect(acharItem(polls, 'ler')).toEqual({ tipo: 'achou', pollId: 'p1', nome: 'Manhã', item: 'Ler', jaMarcado: true })
    expect(acharItem(polls, 'pag')).toMatchObject({ tipo: 'achou', item: 'Ler 10 páginas', jaMarcado: false })
    expect(acharItem(polls, 'a')).toMatchObject({ tipo: 'varios' })
    expect(acharItem(polls, 'nadar')).toEqual({ tipo: 'nenhum' })
  })
})

describe('textos do /paguei', () => {
  it('sucesso', () => {
    expect(textoContaPaga('Luz', 187.4, '2026-10-10')).toBe('✅ Luz paga (R$ 187,40, venc. 10/10).')
  })

  it('variável sem valor sugere o comando com valor', () => {
    expect(textoVariavelSemValor('Luz', 'luz', 187.4)).toBe('Luz é variável: manda /paguei luz 187,40')
    expect(textoVariavelSemValor('Luz', 'luz', 1234.5)).toBe('Luz é variável: manda /paguei luz 1.234,50')
  })

  it('já paga mostra o dia em São Paulo', () => {
    expect(textoContaJaPaga('Luz', '2026-10-05T15:00:00.000Z')).toBe('Luz já estava paga em 05/10.')
    // 01h UTC do dia 6 ainda é dia 5 em São Paulo.
    expect(textoContaJaPaga('Luz', '2026-10-06T01:00:00.000Z')).toBe('Luz já estava paga em 05/10.')
  })

  it('uso, ambígua, não encontrada e sem vencimento', () => {
    expect(textoUsoPaguei()).toContain('/paguei luz')
    const amb = textoContaAmbigua('luz', [conta('Luz casa'), conta('Luz praia')])
    expect(amb).toContain('Achei mais de uma conta com "luz"')
    expect(amb).toContain('• Luz casa')
    expect(amb).toContain('/paguei Luz casa')
    expect(textoContaNaoEncontrada('gás')).toContain('Não achei a conta "gás"')
    expect(textoContaNaoEncontrada('gás')).toContain('/contas')
    expect(textoContaSemVencimento('Luz')).toContain('Luz')
  })
})

describe('/contas e /ajuda com pagamento', () => {
  it('conta paga ganha ✅ no lugar do marcador', () => {
    const t = textoContas(
      [
        { nome: 'Luz', vencimento: '2026-09-25', valor: 120, pagaEm: '2026-09-24T12:00:00.000Z' },
        { nome: 'Água', vencimento: '2026-09-26', valor: 80, pagaEm: null },
      ],
      '2026-09-24',
    )
    const linhas = t.split('\n')
    expect(linhas[2]).toBe('✅ Luz — R$ 120,00 (amanhã)')
    expect(linhas[3]).toBe('• Água — R$ 80,00 (26/09)')
  })

  it('/ajuda lista o /paguei', () => {
    expect(textoAjuda()).toContain('/paguei luz 120 — marca uma conta como paga')
  })
})
