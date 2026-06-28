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
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700
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

      {/* 2행: 시간+소요 / 프로젝트 + 액션 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-2">
          <span>{format(new Date(meeting.date), 'HH:mm')}</span>
          {meeting.duration_minutes != null && (
            <span>· {meeting.duration_minutes}분</span>
          )}
        </span>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {meeting.project ? (
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meeting.project.color }} />
              <span className="truncate max-w-[80px]">{meeting.project.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-300 dark:text-gray-600">
              <span className="w-2 h-2 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" />
              프로젝트 없음
            </span>
          )}

          {/* 액션 버튼들 */}
          <div className="flex items-center gap-0.5">
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
                <div className="absolute right-0 top-8 z-20 w-52
                                bg-white dark:bg-gray-800
                                border border-gray-200 dark:border-gray-700
                                rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      프로젝트 연결
                    </p>
                  </div>
                  <div className="py-1 max-h-56 overflow-y-auto">
                    <button
                      onMouseDown={() => { onProjectChange(null); setShowProjectPicker(false) }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                        !meeting.project_id
                          ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      )}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-500 shrink-0" />
                      <span className="flex-1">연결 없음</span>
                      {!meeting.project_id && (
                        <span className="text-blue-400 text-[10px] font-medium">현재</span>
                      )}
                    </button>
                    {projects.length > 0 && (
                      <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1" />
                    )}
                    {projects.map(p => (
                      <button
                        key={p.id}
                        onMouseDown={() => { onProjectChange(p.id); setShowProjectPicker(false) }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                          meeting.project_id === p.id
                            ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="flex-1 truncate">{p.name}</span>
                        {meeting.project_id === p.id && (
                          <span className="text-blue-400 text-[10px] font-medium">현재</span>
                        )}
                      </button>
                    ))}
                  </div>
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
      </div>
    </div>
  )
}
