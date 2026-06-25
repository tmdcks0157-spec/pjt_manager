import { supabase } from './supabase'
import { requireUserId } from './auth'
import type { Task } from '@/types'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeNextDates(
  startDateStr: string,
  type: string,
  interval: number,
  maxCount = 12,
  maxMonthsAhead = 3,
  endDateStr?: string | null
): string[] {
  const dates: string[] = []
  const start = new Date(startDateStr + 'T00:00:00')
  const cutoff = new Date(start)
  cutoff.setMonth(cutoff.getMonth() + maxMonthsAhead)
  if (endDateStr) {
    const end = new Date(endDateStr + 'T00:00:00')
    if (end < cutoff) cutoff.setTime(end.getTime())
  }

  const cur = new Date(start)

  function advance() {
    switch (type) {
      case 'daily':   cur.setDate(cur.getDate() + interval); break
      case 'weekly':  cur.setDate(cur.getDate() + 7 * interval); break
      case 'monthly': cur.setMonth(cur.getMonth() + interval); break
      case 'yearly':  cur.setFullYear(cur.getFullYear() + interval); break
    }
  }

  advance() // root가 첫 번째이므로 skip

  while (dates.length < maxCount && cur <= cutoff) {
    dates.push(toDateStr(cur))
    advance()
  }

  return dates
}

export async function generateInstances(
  rootId: string,
  rootTask: Partial<Task>,
  type: string,
  interval: number,
  endDate: string | null
): Promise<void> {
  const userId = await requireUserId()
  const startDate = rootTask.due_date?.slice(0, 10)
  if (!startDate) return

  // 미래 인스턴스만 삭제 (과거/완료 이력 보존)
  const nowIso = new Date().toISOString()
  await supabase.from('tasks').delete().eq('parent_task_id', rootId).gt('due_date', nowIso)

  const dates = computeNextDates(startDate, type, interval, 12, 3, endDate)
  if (dates.length === 0) return

  const instances = dates.map(date => ({
    title: rootTask.title ?? '',
    project_id: rootTask.project_id ?? '',
    user_id: userId,
    status: rootTask.status ?? '',
    priority: rootTask.priority ?? 'normal',
    due_date: new Date(date + 'T00:00:00').toISOString(),
    tags: rootTask.tags ?? [],
    description: rootTask.description ?? '',
    notes: '',
    task_type: rootTask.task_type ?? 'task',
    order: 0,
    archived: false,
    parent_task_id: rootId,
    is_recurring_root: false,
    recurrence_type: null,
    recurrence_interval: null,
    recurrence_end: null,
    contact_ids: rootTask.contact_ids ?? [],
    assignee_names: rootTask.assignee_names ?? [],
    contact_id: rootTask.contact_id ?? null,
    assignee_name: rootTask.assignee_name ?? null,
  }))

  await supabase.from('tasks').insert(instances)
}
