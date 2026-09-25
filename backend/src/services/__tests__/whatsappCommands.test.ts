import {
  parseComando,
  textoDaMensagem,
  idDaMensagem,
  ehGrupo,
  candidatosDoRemetente,
  somarDias,
  textoContas,
  textoCarteira,
  textoHoje,
  textoAjuda,
  blocoCarteiraSemana,
  blocoChecklistsSemana,
} from '../whatsappCommands'

describe('parseComando', () => {
  it('reconhece os comandos com barra, sem ligar para caixa e acento', () => {
    expect(parseComando('/contas')).toBe('contas')
    expect(parseComando('  /CARTEIRA ')).toBe('carteira')
    expect(parseComando('/Hoje por favor')).toBe('hoje')
    expect(parseComando('/ajudá')).toBe('ajuda')
  })

  it('ignora texto sem barra', () => {
    expect(parseComando('contas')).toBeNull()
    expect(parseComando('obrigado')).toBeNull()
    expect(parseComando('')).toBeNull()
    expect(parseComando(undefined)).toBeNull()
  })

  it('barra com palavra desconhecida vira desconhecido', () => {
    expect(parseComando('/saldo')).toBe('desconhecido')
    expect(parseComando('/')).toBe('desconhecido')
  })
})

describe('leitura do payload', () => {
  it('acha o texto no body ou no formato do GOWS', () => {
    expect(textoDaMensagem({ body: '/hoje' })).toBe('/hoje')
    expect(textoDaMensagem({ _data: { Message: { conversation: '/contas' } } })).toBe('/contas')
    expect(textoDaMensagem({ _data: { Message: { extendedTextMessage: { text: '/x' } } } })).toBe('/x')
    expect(textoDaMensagem({})).toBeNull()
  })

  it('acha o id como string ou _serialized', () => {
    expect(idDaMensagem({ id: 'ABC' })).toBe('ABC')
    expect(idDaMensagem({ id: { _serialized: 'true_x_ABC' } })).toBe('true_x_ABC')
    expect(idDaMensagem({})).toBeNull()
  })

  it('detecta grupo', () => {
    expect(ehGrupo({ from: '1203@g.us' })).toBe(true)
    expect(ehGrupo({ from: '5511999998888@c.us' })).toBe(false)
  })
})

describe('candidatosDoRemetente', () => {
  it('telefone vira dígitos mais a variante do 9º dígito', () => {
    expect(candidatosDoRemetente({ from: '5511999998888@c.us' }).sort())
      .toEqual(['551199998888', '5511999998888'].sort())
  })

  it('LID entra inteiro, e o telefone alternativo também', () => {
    const c = candidatosDoRemetente({
      from: '51810291171433@lid',
      _data: { Info: { SenderAlt: '5511999998888:12@s.whatsapp.net' } },
    })
    expect(c).toContain('51810291171433@lid')
    expect(c).toContain('5511999998888')
    expect(c).toContain('551199998888')
  })

  it('ignora lixo e grupo', () => {
    expect(candidatosDoRemetente({ from: '1203@g.us', participant: 'x' })).toEqual([])
  })
})

describe('somarDias', () => {
  it('atravessa mês e ano', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(somarDias('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('textoContas', () => {
  it('lista em ordem com hoje/amanhã e total', () => {
    const t = textoContas(
      [
        { nome: 'Internet', vencimento: '2026-09-28', valor: 99.9 },
        { nome: 'Luz', vencimento: '2026-09-25', valor: 120 },
        { nome: 'Água', vencimento: '2026-09-24', valor: 80 },
      ],
      '2026-09-24',
    )
    const linhas = t.split('\n')
    expect(linhas[2]).toBe('• Água — R$ 80,00 (hoje)')
    expect(linhas[3]).toBe('• Luz — R$ 120,00 (amanhã)')
    expect(linhas[4]).toBe('• Internet — R$ 99,90 (28/09)')
    expect(t).toContain('*Total:* R$ 299,90')
  })

  it('sem contas', () => {
    expect(textoContas([], '2026-09-24')).toContain('Nenhuma conta')
  })
})

describe('textoCarteira', () => {
  it('mostra patrimônio e variação desde ontem', () => {
    const t = textoCarteira(
      {
        patrimonio: 10500,
        variacao: { inicio: '2026-09-23', fim: '2026-09-24', patrimonio: 10500, ganho: 150.5, pct: 1.455 },
        semCotacao: 0,
      },
      '2026-09-24',
    )
    expect(t).toContain('*Patrimônio:* R$ 10.500,00')
    expect(t).toContain('*Variação desde ontem:* +R$ 150,50 (+1,46%)')
  })

  it('usa a data quando o snapshot anterior não é de ontem, e sinal de queda', () => {
    const t = textoCarteira(
      {
        patrimonio: 900,
        variacao: { inicio: '2026-09-19', fim: '2026-09-22', patrimonio: 900, ganho: -100, pct: -10 },
        semCotacao: 1,
      },
      '2026-09-22',
    )
    expect(t).toContain('*Variação desde 19/09:* −R$ 100,00 (−10,00%)')
    expect(t).toContain('1 ativo sem cotação ficou de fora')
  })

  it('sem histórico mostra só o patrimônio', () => {
    const t = textoCarteira({ patrimonio: 500, variacao: null, semCotacao: 0 }, '2026-09-24')
    expect(t).not.toContain('Variação')
  })

  it('carteira vazia', () => {
    expect(textoCarteira({ patrimonio: 0, variacao: null, semCotacao: 0 }, '2026-09-24'))
      .toContain('Nenhuma posição')
  })
})

describe('textoHoje', () => {
  it('lista só o que falta marcar', () => {
    const t = textoHoje([
      { nome: 'Manhã', itens: ['Água', 'Treino', 'Leitura'], marcados: ['Treino'] },
      { nome: 'Noite', itens: ['Remédio', 'Diário'], marcados: ['Remédio', 'Diário'] },
    ])
    expect(t).toContain('*Manhã* (1/3)\n◻️ Água\n◻️ Leitura')
    expect(t).toContain('*Noite*\n✅ Tudo marcado')
  })

  it('sem poll hoje', () => {
    expect(textoHoje([])).toContain('Nenhum checklist enviado hoje')
  })
})

describe('textoAjuda', () => {
  it('avisa quando o comando não existe', () => {
    expect(textoAjuda(true).startsWith('Não conheço esse comando.')).toBe(true)
    expect(textoAjuda()).toContain('/contas')
  })
})

describe('blocos do resumo semanal', () => {
  it('carteira some sem variação', () => {
    expect(blocoCarteiraSemana(null)).toBeNull()
    expect(
      blocoCarteiraSemana({ inicio: '2026-09-17', fim: '2026-09-24', patrimonio: 2000, ganho: 40, pct: 2 }),
    ).toBe('*Carteira:* R$ 2.000,00\nNa semana: +R$ 40,00 (+2,00%)')
  })

  it('checklists agrupados com dias completos e média', () => {
    const b = blocoChecklistsSemana([
      { checklistId: 't', nome: 'Treino', completos: 3, total: 3 },
      { checklistId: 't', nome: 'Treino', completos: 1, total: 3 },
      { checklistId: 'a', nome: 'Água', completos: 2, total: 2 },
    ])
    expect(b).toBe('*Checklists:*\n• Água: 1/1 dia completo (100%)\n• Treino: 1/2 dias completos (67%)')
  })

  it('sem polls na semana, bloco some', () => {
    expect(blocoChecklistsSemana([])).toBeNull()
  })
})
