'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AutoTextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  rows?: number
}

export default function AutoTextarea({ value, onChange, placeholder, className, rows = 3 }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ overflow: 'hidden' }}
      className={cn(
        'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 dark:bg-gray-700 dark:text-gray-100 resize-none transition-all',
        className
      )}
    />
  )
}
