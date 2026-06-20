const TAG_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700', 'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700', 'bg-indigo-100 text-indigo-700',
]

export function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

export type DueStatus = 'overdue' | 'today' | 'tomorrow' | null

export function getDueStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return null
}

export const DUE_STATUS_META: Record<NonNullable<DueStatus>, { cardClass: string; badgeClass: string; label: string }> = {
  overdue:  { cardClass: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20',             badgeClass: 'text-red-500',    label: '기한 초과' },
  today:    { cardClass: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20', badgeClass: 'text-orange-500', label: '오늘 마감' },
  tomorrow: { cardClass: 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20', badgeClass: 'text-yellow-600', label: '내일 마감' },
}
