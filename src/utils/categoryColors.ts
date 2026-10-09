// Cor por categoria, para gráficos. As padrão têm cor fixa; a criada pelo
// usuário (chave = uuid) ganha uma da paleta pelo hash da chave, então a mesma
// categoria sai sempre da mesma cor, em qualquer tela.
const CORES_PADRAO: Record<string, string> = {
  'alimentação': '#984061',
  restaurante: '#B4572E',
  transporte: '#7E5700',
  'saúde': '#B3261E',
  lazer: '#8E4EC6',
  compras: '#2E6BB4',
  casa: '#6750A4',
  assinaturas: '#7D5260',
  'serviços': '#386A20',
  'educação': '#1D6C73',
  outro: '#5C5F6E',
}

const PALETA = ['#4F6BD8', '#C25E8C', '#2F8F83', '#A86B1F', '#6D5BD0', '#3E8E41', '#B2453A', '#5A7D9A']

export function categoryColor(key: string): string {
  if (CORES_PADRAO[key]) return CORES_PADRAO[key]
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETA[h % PALETA.length]
}
