'use client'

import { useState } from 'react'
import { Phone, Mail, Users, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateActivity } from '@/hooks/useActivities'
import type { ActivityType } from '@/types'

const TYPES: { type: ActivityType; icon: React.ElementType; label: string; color: string }[] = [
  { type: 'call',    icon: Phone,    label: '통화',   color: 'text-green-600  border-green-200  bg-green-50  dark:bg-green-900/20  dark:border-green-800  dark:text-green-400' },
  { type: 'email',   icon: Mail,     label: '이메일', color: 'text-blue-600   border-blue-200   bg-blue-50   dark:bg-blue-900/20   dark:border-blue-800   dark:text-blue-400' },
  { type: 'meeting', icon: Users,    label: '미팅',   color: 'text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400' },
  { type: 'note',    icon: FileText, label: '메모',   color: 'text-gray-600   border-gray-200   bg-gray-50   dark:bg-gray-700      dark:border-gray-600   dark:text-gray-400' },
]

interface Props {
  contactId: string
  onClose: () => void
}

export default function ActivityForm({ contactId, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [type, setType]   = useState<ActivityType>('call')
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [date, setDate]   = useState(today)
  const [saving, setSaving] = useState(false)

  const createActivity = useCreateActivity()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await createActivity.mutateAsync({
        contact_id: contactId,
        type,
        title: title.trim(),
        body: body.trim() || null,
        activity_date: date,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">활동 기록</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={14} />
        </button>
      </div>

      {/* 유형 선택 */}
      <div className="flex gap-2 mb-3">
        {TYPES.map(({ type: t, icon: Icon, label, color }) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
              type === t ? color : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            )}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목 (예: 예산 확인 통화)" maxLength={200}
            required
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
          />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
          />
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          placeholder="내용 (선택사항)..." maxLength={2000}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving || !title.trim()}
            className={cn('px-4 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg transition-colors',
              saving || !title.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 dark:hover:bg-white')}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
