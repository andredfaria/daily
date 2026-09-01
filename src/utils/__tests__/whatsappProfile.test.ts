import { describe, it, expect } from 'vitest'
import { nomeExibicao, mostrarNomeSalvo } from '../whatsappProfile'

describe('nomeExibicao', () => {
  it('prefere o nome que o próprio usuário definiu no WhatsApp', () => {
    expect(nomeExibicao('André de Faria', 'André Eu', '5535999998888')).toBe('André de Faria')
  })

  it('cai para o nome salvo na agenda quando não há pushName', () => {
    expect(nomeExibicao(null, 'André Eu', '5535999998888')).toBe('André Eu')
  })

  it('cai para o número quando não há nome nenhum', () => {
    expect(nomeExibicao(null, null, '5535999998888')).toBe('5535999998888')
  })

  it('trata string vazia como ausente, não como nome válido', () => {
    expect(nomeExibicao('', '  ', '5535999998888')).toBe('5535999998888')
  })

  it('devolve um traço quando nem número existe', () => {
    expect(nomeExibicao(null, null, null)).toBe('—')
  })
})

describe('mostrarNomeSalvo', () => {
  it('mostra o nome salvo quando ele difere do exibido', () => {
    expect(mostrarNomeSalvo('André de Faria', 'André Eu')).toBe('André Eu')
  })

  it('omite quando é igual ao exibido, para não ecoar', () => {
    expect(mostrarNomeSalvo('André Eu', 'André Eu')).toBeNull()
  })

  it('ignora diferença só de espaço ou caixa', () => {
    expect(mostrarNomeSalvo('André Eu', '  andré eu ')).toBeNull()
  })

  it('omite quando não há nome salvo', () => {
    expect(mostrarNomeSalvo('André de Faria', null)).toBeNull()
  })
})
