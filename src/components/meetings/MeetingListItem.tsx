'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Archive, Trash2, FolderOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Meeting } from '@/types'

type ProjectSlim = { id: string; name: string; color: string }

interface Props {
  meeting: Meeting
  projects: ProjectSlim[]
  onArchive: () => void
  onDelete: () => void
  onProjectChange: (projectId: string | null) => void
}

const STATUS_BADGE: Record<Meeting['status'], { label: string; className: string }> = {
  scheduled:   { label: '예정',   className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  in_progress: { label: '진행중', className: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-500' },
  completed:   { label: '완료',   className: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
}

export default function MeetingListItem({ meeting, projects, onArchive, onDelete, onProjectChange }: Props) {
  const router = useRouter()
  const badge = STATUS_BADGE[meeting.status]
  const openCount = (meeting.action_items ?? []).filter(a => a.status === 'open').length
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="group relative p-3.5 rounded-xl border border-gray-200 dark:border-gray-700
                 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm
                 bg-white dark:bg-gray-800 transition-all cursor-pointer"
      onClick={() => router.push(`/meetings/${meeting.id}`)}
    >
      {/* 1행: 제목 + 상태 뱃지 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {meeting.title}
        </p>
        <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium', badge.className)}>
          {badge.label}
        </span>
      </div>

      {/* 2행: 시간+소요 / 프로젝트 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-2">
          <span>{format(new Date(meeting.date), 'HH:mm')}</span>
          {meeting.duration_minutes != null && (
            <span>· {meeting.duration_minutes}분</span>
          )}
          {openCount > 0 && (
            <span className="text-amber-500">· 미완료 {openCount}건</span>
          )}
        </span>

        {meeting.project ? (
          <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meeting.project.color }} />
            <span className="truncate max-w-[100px]">{meeting.project.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-300 dark:text-gray-600">
            <span className="w-2 h-2 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" />
            프로젝트 없음
          </span>
        )}
      </div>

      {/* 호버 액션 버튼들 */}
      <div
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity
                   flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg
                   border border-gray-200 dark:border-gray-700 shadow-sm px-1 py-0.5"
        onClick={e => e.stopPropagation()}
      >
        {/* 프로젝트 연결 */}
        <div className="relative">
          <button
            onClick={() => { setShowProjectPicker(v => !v); setConfirmDelete(false) }}
            title="프로젝트 연결"
            className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <FolderOpen size={12} />
          </button>

          {showProjectPicker && (
            <div className="absolute right-0 top-7 z-20 w-44 bg-white dark:bg-gray-800
                            border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
              <p className="px-3 py-1 text-[10px] text-gray-400 font-medium border-b border-gray-100 dark:border-gray-700">
                프로젝트 연결
              </p>
              <button
                onMouseDown={() => { onProjectChange(null); setShowProjectPicker(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400
                           hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
              >
                <span className="w-2 h-2 rounded-full border border-gray-300 dark:border-gray-600" />
                연결 없음
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  onMouseDown={() => { onProjectChange(p.id); setShowProjectPicker(false) }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                    'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}</span>
                  {meeting.project_id === p.id && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 보관 */}
        <button
          onClick={() => { onArchive(); setConfirmDelete(false) }}
          title="보관"
          className="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
        >
          <Archive size={12} />
        </button>

        {/* 삭제 */}
        {confirmDelete ? (
          <div className="flex items-center gap-0.5">
            <button
              onMouseDown={onDelete}
              className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600"
            >
              삭제
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="p-1 text-gray-400"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="삭제"
            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
