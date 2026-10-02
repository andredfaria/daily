import { describe, expect, it } from 'vitest'
import { descreverDispositivo } from '../dispositivo'

describe('descreverDispositivo', () => {
  it('Chrome no Android vira celular', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
    expect(descreverDispositivo(ua)).toEqual({ nome: 'Chrome no Android', icone: 'smartphone' })
  })

  it('Safari no iPhone não é confundido com Mac', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    expect(descreverDispositivo(ua)).toEqual({ nome: 'Safari no iPhone', icone: 'smartphone' })
  })

  it('Edge no Windows não é confundido com Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0'
    expect(descreverDispositivo(ua)).toEqual({ nome: 'Edge no Windows', icone: 'computer' })
  })

  it('Samsung Internet', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36'
    expect(descreverDispositivo(ua).nome).toBe('Samsung Internet no Android')
  })

  it('Firefox no Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'
    expect(descreverDispositivo(ua)).toEqual({ nome: 'Firefox no Linux', icone: 'computer' })
  })

  it('sem User-Agent', () => {
    expect(descreverDispositivo(null)).toEqual({ nome: 'Dispositivo desconhecido', icone: 'devices' })
  })
})
