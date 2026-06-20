'use client'

import { X } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
  hideCancel?: boolean
  onConfirm: () => void
}

export default function ConfirmModal({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-bold leading-snug dark:text-gray-100">{options.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 mt-0.5"><X size={15} /></button>
        </div>
        {options.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{options.message}</p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { options.onConfirm(); onClose() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              options.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {options.confirmText ?? '확인'}
          </button>
          {!options.hideCancel && (
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
