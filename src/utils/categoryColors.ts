// Cores e rótulos por categoria (alinhado ao type BillCategory)
export const CATEGORY_COLORS: Record<string, string> = {
  moradia: '#6750A4',
  assinaturas: '#7D5260',
  'serviços': '#386A20',
  'saúde': '#B3261E',
  'educação': '#1D6C73',
  transporte: '#7E5700',
  'alimentação': '#984061',
  outro: '#5C5F6E',
}

export const CATEGORY_LABELS: Record<string, string> = {
  moradia: 'Moradia',
  assinaturas: 'Assinaturas',
  'serviços': 'Serviços',
  'saúde': 'Saúde',
  'educação': 'Educação',
  transporte: 'Transporte',
  'alimentação': 'Alimentação',
  outro: 'Outro',
}

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.outro
}

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat
}
