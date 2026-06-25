'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
}

const STATUS_BADGE: Record<Meeting['status'], { label: string; className: string }> = {
  scheduled:   { label: '예정',   className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  in_progress: { label: '진행중', className: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-500' },
  completed:   { label: '완료',   className: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
}

export default function MeetingListItem({ meeting }: Props) {
  const badge = STATUS_BADGE[meeting.status]
  const openCount = (meeting.action_items ?? []).filter(a => a.status === 'open').length

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="block p-3.5 rounded-xl border border-gray-200 dark:border-gray-700
                 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm
                 bg-white dark:bg-gray-800 transition-all"
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

      {/* 2행: 시간+소요 / 프로젝트 연결 여부 */}
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
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: meeting.project.color }}
            />
            <span className="truncate max-w-[120px]">{meeting.project.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-300 dark:text-gray-600">
            <span className="w-2 h-2 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" />
            프로젝트 없음
          </span>
        )}
      </div>
    </Link>
  )
}
