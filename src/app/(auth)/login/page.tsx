'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'

const FEATURES = [
  '칸반 보드로 프로젝트를 시각적으로 관리',
  '캘린더에서 마감일을 한눈에 확인',
  'CRM으로 연락처·회사·활동 기록',
  '주간 리포트로 생산성 패턴 파악',
]

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      queryClient.invalidateQueries()
      router.push('/dashboard')
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <main className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* 왼쪽: 앱 소개 */}
      <div className="hidden lg:flex flex-col justify-center px-16 flex-1 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800">
        <div className="max-w-sm">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">My PM</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-10 text-base leading-relaxed">
            혼자 쓰기 좋은 프로젝트 관리 도구.<br />
            할 일부터 연락처까지 한 곳에서.
          </p>
          <ul className="space-y-4">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle2 size={17} className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 오른쪽: 로그인 폼 */}
      <div className="flex flex-col justify-center items-center flex-1 px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1 lg:text-left">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 lg:hidden">My PM</p>
            <h2 className="text-xl font-semibold dark:text-gray-100">로그인</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">계정에 접속하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium dark:text-gray-300">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium dark:text-gray-300">비밀번호</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gray-900 dark:bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-gray-900 dark:text-gray-100 font-medium underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
