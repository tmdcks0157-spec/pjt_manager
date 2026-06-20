'use client'

import { X } from 'lucide-react'
import type { Task, Project } from '@/types'

export default function MoveToProjectModal({ task, projects, currentProjectId, onClose, onMove }: {
  task: Task
  projects: Project[]
  currentProjectId: string
  onClose: () => void
  onMove: (task: Task, targetProjectId: string) => void
}) {
  const others = projects.filter(p => p.id !== currentProjectId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold dark:text-gray-100">다른 프로젝트로 이동</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">"{task.title}"을(를) 이동할 프로젝트 선택</p>
        <div className="space-y-1.5 max-h-60 overflow-auto">
          {others.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">다른 프로젝트가 없습니다</p>
          ) : others.map(p => (
            <button key={p.id} onClick={() => { onMove(task, p.id); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
