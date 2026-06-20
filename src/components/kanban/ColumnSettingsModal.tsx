'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectColumn } from '@/types'

export default function ColumnSettingsModal({ column, onClose, onSave }: {
  column: ProjectColumn
  onClose: () => void
  onSave: (name: string, limit: number | null) => void
}) {
  const [name, setName] = useState(column.name)
  const [wipValue, setWipValue] = useState(column.wip_limit?.toString() ?? '')

  function handleSave() {
    const num = parseInt(wipValue)
    onSave(name.trim() || column.name, isNaN(num) || num <= 0 ? null : num)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">컬럼 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">컬럼 이름</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">WIP 한도 <span className="text-gray-300 dark:text-gray-600 font-normal">(비우면 한도 없음)</span></label>
          <input type="number" min="1" value={wipValue} onChange={e => setWipValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            placeholder="최대 태스크 수"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">저장</button>
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}
