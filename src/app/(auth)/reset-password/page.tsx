'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [hashError, setHashError] = useState('')

  useEffect(() => {
    // URL 해시에 Supabase 에러가 포함된 경우 먼저 감지 (만료/무효 링크)
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.slice(1))
      const code = params.get('error_code') ?? ''
      const desc = params.get('error_description') ?? ''
      if (code === 'otp_expired') {
        setHashError('링크가 만료되었습니다. 새로 요청해주세요.')
      } else {
        setHashError(desc.replace(/\+/g, ' ') || '유효하지 않은 링크입니다.')
      }
      return
    }

    // 정상 토큰: Supabase가 해시를 파싱해 PASSWORD_RECOVERY 이벤트 발생
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.replace('/login'), 2500)
    } catch {
      setError('비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-3">
          <p className="text-xl font-semibold dark:text-gray-100">비밀번호가 변경되었습니다</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">잠시 후 로그인 페이지로 이동합니다.</p>
        </div>
      </main>
    )
  }

  if (hashError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm space-y-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={14} />
            로그인으로 돌아가기
          </Link>
          <div className="text-center space-y-3 py-6">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100">{hashError}</p>
            <Link
              href="/forgot-password"
              className="inline-block mt-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              재설정 링크 다시 받기
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">링크를 확인하는 중...</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            링크가 만료된 경우{' '}
            <Link href="/forgot-password" className="underline hover:text-gray-700 dark:hover:text-gray-200">
              다시 요청
            </Link>
            해주세요.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={14} />
          로그인으로 돌아가기
        </Link>

        <div className="space-y-1">
          <h2 className="text-xl font-semibold dark:text-gray-100">새 비밀번호 설정</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">8자 이상으로 입력해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium dark:text-gray-300">새 비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                placeholder="8자 이상"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium dark:text-gray-300">비밀번호 확인</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
              placeholder="동일하게 입력"
            />
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gray-900 dark:bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </main>
  )
}
