'use client'

import { useEffect, useState } from 'react'
import { useTheme, type Theme } from '@/providers/ThemeProvider'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Monitor, Moon, Sun, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

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
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [startPage, setStartPage] = useState<StartPage>('/today')

  // 계정 삭제 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('세션 없음')

      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? '삭제 실패')
      }
      await logout()
      router.replace('/login')
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteLoading(false)
    }
  }

  // 비밀번호 변경 상태
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw]   = useState(false)
  const [pwLoading, setPwLoading]   = useState(false)
  const [pwResult, setPwResult]     = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('start-page') as StartPage
    if (saved) setStartPage(saved)
  }, [])

  function handleStartPage(value: StartPage) {
    setStartPage(value)
    localStorage.setItem('start-page', value)
  }

  async function handlePasswordChange() {
    setPwResult(null)
    if (!currentPw || !newPw || !confirmPw) {
      setPwResult({ ok: false, msg: '모든 항목을 입력해주세요.' })
      return
    }
    if (newPw.length < 6) {
      setPwResult({ ok: false, msg: '새 비밀번호는 6자 이상이어야 합니다.' })
      return
    }
    if (newPw !== confirmPw) {
      setPwResult({ ok: false, msg: '새 비밀번호가 일치하지 않습니다.' })
      return
    }
    setPwLoading(true)
    // 현재 비밀번호 확인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPw,
    })
    if (signInError) {
      setPwLoading(false)
      setPwResult({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' })
      return
    }
    // 비밀번호 변경
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwResult({ ok: false, msg: error.message })
    } else {
      setPwResult({ ok: true, msg: '비밀번호가 변경되었습니다.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
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

      {/* 비밀번호 변경 */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">비밀번호 변경</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          {/* 현재 비밀번호 */}
          <div className="relative">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">현재 비밀번호</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="현재 비밀번호"
                className="w-full pl-9 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
              />
              <button onClick={() => setShowCurrentPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {/* 새 비밀번호 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">새 비밀번호</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                className="w-full pl-9 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
              />
              <button onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {/* 새 비밀번호 확인 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">새 비밀번호 확인</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
                placeholder="새 비밀번호 재입력"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
              />
            </div>
          </div>

          {/* 결과 메시지 */}
          {pwResult && (
            <div className={cn('flex items-center gap-2 text-xs px-3 py-2 rounded-lg', pwResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400')}>
              {pwResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {pwResult.msg}
            </div>
          )}

          <button
            onClick={handlePasswordChange}
            disabled={pwLoading}
            className="w-full py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {pwLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
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
      <section className="mb-8">
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
      {/* 계정 삭제 */}
      <section>
        <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">위험 구역</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">계정 삭제</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.</p>
            </div>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); setDeleteError('') }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={13} />
              계정 삭제
            </button>
          </div>
        </div>
      </section>

      {/* 계정 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">정말 계정을 삭제할까요?</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                프로젝트, 태스크, CRM 데이터 등 <span className="font-semibold text-red-500">모든 데이터가 영구 삭제</span>됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                확인을 위해 아래에 <span className="font-bold text-gray-700 dark:text-gray-300">삭제</span>를 입력하세요
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="삭제"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            {deleteError && (
              <p className="text-xs text-red-500">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== '삭제' || deleteLoading}
                className="flex-1 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? '삭제 중...' : '영구 삭제'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
