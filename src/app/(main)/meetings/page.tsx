'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown } from 'lucide-react'
import { format, isToday, isThisWeek, isThisMonth, subWeeks } from 'date-fns'
import { ko } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import MeetingMiniCalendar from '@/components/meetings/MeetingMiniCalendar'
import MeetingListItem from '@/components/meetings/MeetingListItem'
import type { Meeting } from '@/types'

type ProjectSlim = { id: string; name: string; color: string }

function groupMeetings(meetings: Meeting[]): [string, Meeting[]][] {
  const groups: Record<string, Meeting[]> = {}

  for (const m of meetings) {
    const d = new Date(m.date)
    let label: string
    if (isToday(d)) label = '오늘'
    else if (isThisWeek(d, { weekStartsOn: 1 })) label = '이번 주'
    else if (d >= subWeeks(new Date(), 1) && d < new Date()) label = '지난 주'
    else if (isThisMonth(d)) label = '이번 달'
    else label = format(d, 'yyyy년 M월', { locale: ko })

    if (!groups[label]) groups[label] = []
    groups[label].push(m)
  }

  const order = ['오늘', '이번 주', '지난 주', '이번 달']
  return Object.entries(groups).sort(([a], [b]) => {
    const ia = order.indexOf(a), ib = order.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return b.localeCompare(a)
  })
}

export default function MeetingsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data: rawMeetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    enabled: !!user,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, date, duration_minutes, status, project_id, archived, deleted_at')
        .is('deleted_at', null)
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: projects = [] } = useQuery<ProjectSlim[]>({
    queryKey: ['projects-slim'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, color')
        .is('deleted_at', null)
        .eq('archived', false)
      return (data ?? []) as ProjectSlim[]
    },
  })

  const projectsMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p])),
    [projects]
  )

  const allMeetings = useMemo(
    () => rawMeetings.map(m => ({
      ...m,
      project: m.project_id ? (projectsMap[m.project_id] ?? null) : null,
    })) as unknown as Meeting[],
    [rawMeetings, projectsMap]
  )

  const meetings = allMeetings.filter(m => !m.archived)
  const archivedMeetings = allMeetings.filter(m => m.archived)

  const createMutation = useMutation({
    mutationFn: async () => {
      const userId = await requireUserId()
      const { data, error } = await supabase
        .from('meetings')
        .insert({ user_id: userId, title: '제목 없는 회의', date: new Date().toISOString() })
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: (meeting) => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      router.push(`/meetings/${meeting.id}`)
    },
  })

  function archiveMeeting(id: string) {
    supabase.from('meetings').update({ archived: true }).eq('id', id).then(() => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    })
  }

  function unarchiveMeeting(id: string) {
    supabase.from('meetings').update({ archived: false }).eq('id', id).then(() => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    })
  }

  function deleteMeeting(id: string) {
    supabase.from('meetings').update({ deleted_at: new Date().toISOString() }).eq('id', id).then(() => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    })
  }

  function changeProject(meetingId: string, projectId: string | null) {
    supabase.from('meetings').update({ project_id: projectId }).eq('id', meetingId).then(() => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    })
  }

  const filtered = useMemo(() => {
    if (!selectedDate) return meetings
    return meetings.filter(m => m.date.startsWith(selectedDate))
  }, [meetings, selectedDate])

  const grouped = groupMeetings(filtered)

  const thisMonth = new Date()
  const monthMeetings = meetings.filter(m => {
    const d = new Date(m.date)
    return d.getFullYear() === thisMonth.getFullYear() && d.getMonth() === thisMonth.getMonth()
  })
  const monthCount = monthMeetings.length
  const monthMinutes = monthMeetings.reduce((s, m) => s + (m.duration_minutes ?? 0), 0)
  const monthHours = (monthMinutes / 60).toFixed(1)

  return (
    <div className="flex h-full overflow-hidden">
      {/* 왼쪽: 미니 캘린더 */}
      <div className="w-60 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
        <MeetingMiniCalendar
          meetings={meetings}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">이번 달</p>
          <p className="text-xs text-gray-700 dark:text-gray-300">
            {monthCount}회
            {monthMinutes > 0 && ` · ${monthHours}시간`}
          </p>
        </div>
      </div>

      {/* 오른쪽: 리스트 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">회의록</h1>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-gray-100
                         text-white dark:text-gray-900 rounded-lg text-sm font-medium
                         hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <Plus size={14} />
              새 회의
            </button>
          </div>

          {isLoading && (
            <p className="text-sm text-gray-400 text-center py-12">불러오는 중...</p>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-gray-400">
                {selectedDate ? `${selectedDate}에 회의가 없습니다.` : '아직 회의록이 없습니다.'}
              </p>
              {!selectedDate && (
                <button
                  onClick={() => createMutation.mutate()}
                  className="mt-3 text-sm text-blue-500 hover:text-blue-600"
                >
                  첫 번째 회의 만들기
                </button>
              )}
            </div>
          )}

          {grouped.map(([label, items]) => (
            <section key={label} className="mb-6">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                {label}
              </h2>
              <div className="space-y-2">
                {items.map(m => (
                  <MeetingListItem
                    key={m.id}
                    meeting={m}
                    projects={projects}
                    onArchive={() => archiveMeeting(m.id)}
                    onDelete={() => deleteMeeting(m.id)}
                    onProjectChange={(pid) => changeProject(m.id, pid)}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* 보관된 회의록 */}
          {archivedMeetings.length > 0 && (
            <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-6">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3"
              >
                <ChevronDown size={13} className={showArchived ? '' : '-rotate-90'} />
                보관된 회의 {archivedMeetings.length}건
              </button>
              {showArchived && (
                <div className="space-y-2 opacity-60">
                  {archivedMeetings.map(m => (
                    <MeetingListItem
                      key={m.id}
                      meeting={m}
                      projects={projects}
                      onArchive={() => unarchiveMeeting(m.id)}
                      onDelete={() => deleteMeeting(m.id)}
                      onProjectChange={(pid) => changeProject(m.id, pid)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
