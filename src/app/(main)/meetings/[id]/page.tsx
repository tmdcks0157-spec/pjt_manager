'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Calendar, FolderOpen } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import MeetingMiniCalendar from '@/components/meetings/MeetingMiniCalendar'
import MeetingTimer from '@/components/meetings/MeetingTimer'
import MeetingAgenda from '@/components/meetings/MeetingAgenda'
import MeetingNotes from '@/components/meetings/MeetingNotes'
import MeetingAttendees from '@/components/meetings/MeetingAttendees'
import ActionItemPanel from '@/components/meetings/ActionItemPanel'
import type { Meeting, ActionItem } from '@/types'

type ProjectSlim = { id: string; name: string; color: string }

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  // project JOIN 제거 — FK 미정의로 PostgREST 오류 방지
  const { data: rawMeeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    enabled: !!user,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, attendees:meeting_attendees(*), action_items(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  // 목록용 (미니 캘린더 dot 표시)
  const { data: allMeetings = [] } = useQuery<Meeting[]>({
    queryKey: ['meetings'],
    enabled: !!user,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, date, status, project_id')
        .order('date', { ascending: false })
      return (data ?? []) as Meeting[]
    },
  })

  // 프로젝트 목록 (export picker + project 정보 병합용)
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
        .order('name')
      return data ?? []
    },
  })

  // project 정보를 프론트에서 병합
  const meeting: Meeting | undefined = rawMeeting
    ? {
        ...rawMeeting,
        project: rawMeeting.project_id
          ? (projects.find((p: ProjectSlim) => p.id === rawMeeting.project_id) ?? null)
          : null,
      } as unknown as Meeting
    : undefined

  // 이전 회의 미완료 액션 아이템 (같은 project_id 범위만)
  const { data: pendingFromPrev = [] } = useQuery<ActionItem[]>({
    queryKey: ['pending-actions', id, rawMeeting?.project_id],
    enabled: !!user && !!rawMeeting?.project_id,
    queryFn: async () => {
      const { data: siblingMeetings } = await supabase
        .from('meetings').select('id')
        .eq('project_id', rawMeeting!.project_id!).neq('id', id)
      const siblingIds = (siblingMeetings ?? []).map(m => m.id)
      if (siblingIds.length === 0) return []
      const { data } = await supabase
        .from('action_items').select('*')
        .eq('status', 'open').in('meeting_id', siblingIds)
        .order('created_at', { ascending: false }).limit(10)
      return data ?? []
    },
  })

  function handleUpdate(patch: Partial<Meeting>) {
    qc.setQueryData(['meeting', id], (prev: typeof rawMeeting) => prev ? { ...prev, ...patch } : prev)
  }

  // 인라인 제목 편집
  const [title, setTitle] = useState('')
  const [titleInit, setTitleInit] = useState(false)
  if (meeting && !titleInit) { setTitle(meeting.title); setTitleInit(true) }

  async function handleTitleBlur() {
    if (!meeting || title === meeting.title) return
    await supabase.from('meetings').update({ title }).eq('id', id)
    handleUpdate({ title })
  }

  // 날짜 편집
  async function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!meeting) return
    const date = new Date(e.target.value).toISOString()
    await supabase.from('meetings').update({ date }).eq('id', id)
    handleUpdate({ date })
  }

  // 프로젝트 연결
  async function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value || null
    await supabase.from('meetings').update({ project_id: value }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['meeting', id] })
  }

  if (isLoading || !rawMeeting || !meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 상단 헤더 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <Link href="/meetings" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ChevronLeft size={18} />
        </Link>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 font-semibold text-base bg-transparent text-gray-900 dark:text-gray-100
                     focus:outline-none border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600
                     transition-colors"
        />

        <MeetingTimer meeting={meeting} onUpdate={handleUpdate} />
      </div>

      {/* 3열 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽 — 미니캘린더 + 기본 정보 */}
        <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-4">
          <MeetingMiniCalendar
            meetings={allMeetings}
            selectedDate={meeting.date.slice(0, 10)}
            onSelectDate={() => {}}
          />

          {/* 기본 정보 */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                <Calendar size={10} /> 날짜·시간
              </p>
              <input
                type="datetime-local"
                defaultValue={meeting.date.slice(0, 16)}
                onChange={handleDateChange}
                className="w-full text-xs text-gray-600 dark:text-gray-400 bg-transparent
                           focus:outline-none border border-transparent hover:border-gray-200 dark:hover:border-gray-700
                           rounded px-1 py-0.5 transition-colors"
              />
            </div>

            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                <FolderOpen size={10} /> 프로젝트
              </p>
              <select
                value={meeting.project_id ?? ''}
                onChange={handleProjectChange}
                className="w-full text-xs text-gray-600 dark:text-gray-400 bg-transparent
                           focus:outline-none border border-transparent hover:border-gray-200 dark:hover:border-gray-700
                           rounded px-1 py-0.5 transition-colors cursor-pointer"
              >
                <option value="">프로젝트 없음</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <MeetingAttendees meeting={meeting} />
          </div>
        </div>

        {/* 중앙 — 안건 + 메모 */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700">
          <MeetingAgenda meeting={meeting} onUpdate={handleUpdate} />
          <MeetingNotes meeting={meeting} onUpdate={handleUpdate} />
        </div>

        {/* 오른쪽 — 액션 아이템 */}
        <div className="w-96 shrink-0 overflow-hidden flex flex-col">
          <ActionItemPanel
            meetingId={id}
            meeting={meeting}
            actionItems={meeting.action_items ?? []}
            pendingFromPrev={pendingFromPrev}
            projects={projects}
          />
        </div>
      </div>
    </div>
  )
}
