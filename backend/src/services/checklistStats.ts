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

export interface ChecklistItemStreak {
  text: string
  current: number
  best: number
}

export function computeItemStreaks(
  itemTexts: string[],
  pollsSelectedOptionsChronological: string[][],
): ChecklistItemStreak[] {
  return itemTexts.map((text) => {
    let current = 0
    let best = 0
    for (const options of pollsSelectedOptionsChronological) {
      if (options.includes(text)) {
        current += 1
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return { text, current, best }
  })
}
