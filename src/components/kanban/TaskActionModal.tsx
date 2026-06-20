'use client'

import { X, Maximize2, ChevronRight, Copy, FolderInput, Archive, Trash2 } from 'lucide-react'
import type { Task, ProjectColumn } from '@/types'

export default function TaskActionModal({ task, columns, onClose, onOpenModal, onMove, onCopy, onShowMoveProject, onArchive, onSoftDelete }: {
  task: Task
  columns: ProjectColumn[]
  onClose: () => void
  onOpenModal: () => void
  onMove: (columnId: string) => void
  onCopy: () => void
  onShowMoveProject: () => void
  onArchive: () => void
  onSoftDelete: () => void
}) {
  const otherCols = columns.filter(c => c.id !== task.status)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-72 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate dark:text-gray-100">{task.title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"><X size={15} /></button>
        </div>
        <div className="py-1.5">
          <button onClick={() => { onOpenModal(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <Maximize2 size={15} className="text-blue-400 shrink-0" /> 열기
          </button>
          {otherCols.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              {otherCols.map(c => (
                <button key={c.id} onClick={() => { onMove(c.id); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                  <ChevronRight size={15} className="text-gray-400 shrink-0" />
                  <span className="truncate">{c.name}으로 이동</span>
                </button>
              ))}
            </>
          )}
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button onClick={() => { onCopy(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <Copy size={15} className="text-green-500 shrink-0" /> 복사
          </button>
          <button onClick={() => { onShowMoveProject(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <FolderInput size={15} className="text-purple-500 shrink-0" /> 다른 프로젝트로 이동
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button onClick={() => { onArchive(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm text-amber-600 transition-colors">
            <Archive size={15} className="shrink-0" /> 보관
          </button>
          <button onClick={() => { onSoftDelete(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500 transition-colors">
            <Trash2 size={15} className="shrink-0" /> 삭제
          </button>
        </div>
      </div>
    </div>
  )
}
