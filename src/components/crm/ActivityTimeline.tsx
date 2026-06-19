'use client'

import { useState } from 'react'
import { Phone, Mail, Users, FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeleteActivity } from '@/hooks/useActivities'
import type { Activity, ActivityType } from '@/types'

const TYPE_META: Record<ActivityType, { icon: React.ElementType; label: string; color: string }> = {
  call:    { icon: Phone,    label: '통화',   color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  email:   { icon: Mail,     label: '이메일', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  meeting: { icon: Users,    label: '미팅',   color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
  note:    { icon: FileText, label: '메모',   color: 'text-gray-500 bg-gray-100 dark:bg-gray-700' },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function ActivityItem({ activity }: { activity: Activity }) {
  const [expanded, setExpanded] = useState(false)
  const deleteActivity = useDeleteActivity()
  const meta = TYPE_META[activity.type]
  const Icon = meta.icon
  const hasBody = !!activity.body?.trim()

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', meta.color)}>
          <Icon size={13} />
        </div>
        <div className="w-px flex-1 bg-gray-100 dark:bg-gray-700 mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{fmtDate(activity.activity_date)}</span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', meta.color)}>{meta.label}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.title}</p>
          </div>
          <button
            onClick={() => deleteActivity.mutate({ id: activity.id, contact_id: activity.contact_id })}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
        {hasBody && (
          <div className="mt-1">
            <p className={cn('text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap',
              !expanded && 'line-clamp-2')}>
              {activity.body}
            </p>
            {activity.body!.length > 120 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-1 flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {expanded ? <><ChevronUp size={10} /> 접기</> : <><ChevronDown size={10} /> 더 보기</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  activities: Activity[]
}

export default function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <FileText size={28} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">활동 기록이 없습니다</p>
        <p className="text-xs mt-1">위 버튼으로 첫 활동을 기록해보세요</p>
      </div>
    )
  }

  return (
    <div className="pt-2">
      {activities.map(a => <ActivityItem key={a.id} activity={a} />)}
    </div>
  )
}
