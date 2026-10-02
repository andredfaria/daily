import {
  parseComando,
  argumentosDoComando,
  parseValor,
  parseGasto,
  acharItem,
  unirMarcados,
  lerListaJson,
  textoMarcado,
  textoItemNaoEncontrado,
  PollParaMarcar,
} from '../whatsappCommands'

describe('parseComando com os comandos que gravam', () => {
  it('reconhece /gasto e /marcar com argumentos', () => {
    expect(parseComando('/gasto 45 mercado')).toBe('gasto')
    expect(parseComando('/Marcar academia')).toBe('marcar')
  })
})

describe('argumentosDoComando', () => {
  it('devolve o resto como foi digitado', () => {
    expect(argumentosDoComando('  /gasto   45 Pão de Açúcar ')).toBe('45 Pão de Açúcar')
    expect(argumentosDoComando('/marcar')).toBe('')
  })
})

describe('parseValor', () => {
  it.each([
    ['45', 45],
    ['45,90', 45.9],
    ['45.90', 45.9],
    ['45.9', 45.9],
    ['1.234', 1234],
    ['1.234,56', 1234.56],
    ['R$45', 45],
    ['r$12,5', 12.5],
  ])('%s → %d', (entrada, esperado) => {
    expect(parseValor(entrada)).toBe(esperado)
  })

  it.each(['mercado', '0', '0,00', '-5', '12,345', '1,2,3', '100000000'])('recusa %s', (entrada) => {
    expect(parseValor(entrada)).toBeNull()
  })
})

describe('parseGasto', () => {
  it('valor no começo', () => {
    expect(parseGasto('45 mercado')).toEqual({ valor: 45, descricao: 'mercado', categoria: 'alimentação' })
  })

  it('valor no fim', () => {
    expect(parseGasto('pão de queijo 12,50')).toEqual({ valor: 12.5, descricao: 'pão de queijo', categoria: 'outro' })
  })

  it('R$ separado do número', () => {
    expect(parseGasto('R$ 30 farmácia')).toEqual({ valor: 30, descricao: 'farmácia', categoria: 'saúde' })
  })

  it('sem descrição entra assim mesmo', () => {
    expect(parseGasto('45')).toEqual({ valor: 45, descricao: 'Sem descrição', categoria: 'outro' })
  })

  it('#categoria escolhe e sai da descrição', () => {
    expect(parseGasto('80 presente #lazer')).toEqual({ valor: 80, descricao: 'presente', categoria: 'lazer' })
    expect(parseGasto('#saude 50')).toEqual({ valor: 50, descricao: 'Sem descrição', categoria: 'saúde' })
  })

  it('sem valor não é gasto', () => {
    expect(parseGasto('mercado')).toBeNull()
    expect(parseGasto('')).toBeNull()
  })

  it('corta descrição longa em 120 caracteres', () => {
    expect(parseGasto(`10 ${'a'.repeat(200)}`)!.descricao).toHaveLength(120)
  })
})

const polls: PollParaMarcar[] = [
  { pollId: 'p1', nome: 'Manhã', itens: ['Academia', 'Ler', 'Ler 10 páginas'], marcados: ['Ler'] },
  { pollId: 'p2', nome: 'Noite', itens: ['Meditação', 'Alongar'], marcados: [] },
]

describe('acharItem', () => {
  it('ignora acento e maiúscula', () => {
    expect(acharItem(polls, 'meditacao')).toEqual({
      tipo: 'achou', pollId: 'p2', nome: 'Noite', item: 'Meditação', jaMarcado: false,
    })
  })

  it('acha por trecho', () => {
    expect(acharItem(polls, 'acad')).toMatchObject({ tipo: 'achou', item: 'Academia' })
  })

  it('nome exato ganha de trecho', () => {
    expect(acharItem(polls, 'ler')).toMatchObject({ tipo: 'achou', item: 'Ler', jaMarcado: true })
  })

  it('trecho em mais de um item é ambíguo', () => {
    expect(acharItem(polls, 'a')).toMatchObject({ tipo: 'varios' })
  })

  it('nada encontrado', () => {
    expect(acharItem(polls, 'correr')).toEqual({ tipo: 'nenhum' })
    expect(acharItem(polls, '   ')).toEqual({ tipo: 'nenhum' })
  })
})

describe('unirMarcados', () => {
  const itens = ['A', 'B', 'C']

  it('voto da enquete não apaga o que veio por /marcar', () => {
    expect(unirMarcados(['C'], ['A'], itens)).toEqual(['A', 'C'])
  })

  it('não duplica item marcado nos dois lugares', () => {
    expect(unirMarcados(['A'], ['A'], itens)).toEqual(['A'])
  })

  it('mantém voto em item que saiu do checklist', () => {
    expect(unirMarcados(['Z'], ['A'], itens)).toEqual(['A', 'Z'])
  })
})

describe('lerListaJson', () => {
  it('aceita array, string JSON e lixo', () => {
    expect(lerListaJson(['a'])).toEqual(['a'])
    expect(lerListaJson('["a","b"]')).toEqual(['a', 'b'])
    expect(lerListaJson('{x')).toEqual([])
    expect(lerListaJson(null)).toEqual([])
  })
})

describe('textos do /marcar', () => {
  it('comemora o checklist completo', () => {
    expect(textoMarcado('Alongar', 'Noite', 2, 2)).toContain('🎉')
    expect(textoMarcado('Alongar', 'Noite', 1, 2)).not.toContain('🎉')
  })

  it('não encontrado lista o que falta', () => {
    const msg = textoItemNaoEncontrado('correr', polls)
    expect(msg).toContain('◻️ Academia')
    expect(msg).not.toContain('◻️ Ler\n')
  })
})
