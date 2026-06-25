'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, isSameDay, parseISO,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Meeting } from '@/types'

interface Props {
  meetings: Meeting[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function MeetingMiniCalendar({ meetings, selectedDate, onSelectDate }: Props) {
  const [viewDate, setViewDate] = useState(new Date())

  const datesWithMeetings = useMemo(
    () => new Set(meetings.map(m => m.date.slice(0, 10))),
    [meetings]
  )

  const days = useMemo(() => {
    const start = startOfMonth(viewDate)
    const end = endOfMonth(viewDate)
    return eachDayOfInterval({ start, end })
  }, [viewDate])

  const leadingBlanks = getDay(startOfMonth(viewDate))

  function handleDayClick(day: Date) {
    const str = format(day, 'yyyy-MM-dd')
    onSelectDate(selectedDate === str ? null : str)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {format(viewDate, 'yyyy년 M월', { locale: ko })}
        </span>
        <button
          onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map(day => {
          const str = format(day, 'yyyy-MM-dd')
          const hasM = datesWithMeetings.has(str)
          const isSelected = selectedDate === str
          const today = isToday(day)

          return (
            <button
              key={str}
              onClick={() => handleDayClick(day)}
              className={cn(
                'relative h-7 w-7 mx-auto flex items-center justify-center rounded-full text-[11px] transition-colors',
                isSelected
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : today
                    ? 'text-blue-600 dark:text-blue-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {format(day, 'd')}
              {hasM && (
                <span className={cn(
                  'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                  isSelected ? 'bg-white dark:bg-gray-900' : 'bg-blue-400'
                )} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
