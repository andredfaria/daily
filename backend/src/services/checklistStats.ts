export interface ChecklistItemStat {
  text: string
  marked_count: number
  total_polls: number
  pct: number
}

export function computeItemStats(
  itemTexts: string[],
  pollsSelectedOptions: string[][],
): ChecklistItemStat[] {
  const totalPolls = pollsSelectedOptions.length
  const stats: ChecklistItemStat[] = itemTexts.map((text) => {
    const markedCount = pollsSelectedOptions.filter((options) => options.includes(text)).length
    const pct = totalPolls === 0 ? 0 : Math.round((markedCount / totalPolls) * 100)
    return { text, marked_count: markedCount, total_polls: totalPolls, pct }
  })
  return stats.sort((a, b) => b.pct - a.pct)
}
