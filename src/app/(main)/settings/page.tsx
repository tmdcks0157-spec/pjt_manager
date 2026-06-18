'use client'

import { useEffect, useState } from 'react'
import { useTheme, type Theme } from '@/providers/ThemeProvider'
import { useAuthStore } from '@/stores/auth-store'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type StartPage = '/today' | '/dashboard' | '/overview' | '/calendar' | '/report'

const START_PAGE_OPTIONS: { value: StartPage; label: string }[] = [
  { value: '/today',     label: '오늘' },
  { value: '/dashboard', label: '프로젝트' },
  { value: '/overview',  label: '전체 현황' },
  { value: '/calendar',  label: '캘린더' },
  { value: '/report',    label: '주간 리포트' },
]

const THEME_OPTIONS: { value: Theme; label: string; Icon: React.ElementType }[] = [
  { value: 'light',  label: '라이트', Icon: Sun },
  { value: 'dark',   label: '다크',   Icon: Moon },
  { value: 'system', label: '시스템', Icon: Monitor },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuthStore()
  const [startPage, setStartPage] = useState<StartPage>('/today')

  useEffect(() => {
    const saved = localStorage.getItem('start-page') as StartPage
    if (saved) setStartPage(saved)
  }, [])

  function handleStartPage(value: StartPage) {
    setStartPage(value)
    localStorage.setItem('start-page', value)
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-8">설정</h1>

      {/* 계정 */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">계정</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">이메일</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{user?.email}</p>
        </div>
      </section>

      {/* 테마 */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">테마</h2>
        <div className="flex gap-3">
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition-all',
                theme === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <Icon
                size={20}
                className={theme === value ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}
              />
              <span className={cn(
                'text-sm font-medium',
                theme === value
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          시스템: OS 다크모드 설정을 자동으로 따릅니다
        </p>
      </section>

      {/* 시작 페이지 */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">로그인 후 시작 페이지</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {START_PAGE_OPTIONS.map(({ value, label }, i) => (
            <button
              key={value}
              onClick={() => handleStartPage(value)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-sm transition-colors',
                i > 0 && 'border-t border-gray-100 dark:border-gray-700',
                startPage === value
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <span>{label}</span>
              {startPage === value && (
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
