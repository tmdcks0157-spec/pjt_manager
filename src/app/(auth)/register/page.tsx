'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { CheckCircle2 } from 'lucide-react'

const FEATURES = [
  '칸반 보드로 프로젝트를 시각적으로 관리',
  '캘린더에서 마감일을 한눈에 확인',
  'CRM으로 연락처·회사·활동 기록',
  '주간 리포트로 생산성 패턴 파악',
]

export default function RegisterPage() {
  const router = useRouter()
  const { signup, isLoading } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signup(email, password, name)
      router.push('/dashboard')
    } catch {
      setError('회원가입에 실패했습니다. 다시 시도해주세요.')
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

      {/* 오른쪽: 회원가입 폼 */}
      <div className="flex flex-col justify-center items-center flex-1 px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1 lg:text-left">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 lg:hidden">My PM</p>
            <h2 className="text-xl font-semibold dark:text-gray-100">회원가입</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">나만의 프로젝트 관리를 시작하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium dark:text-gray-300">이름 (선택)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                placeholder="홍길동"
              />
            </div>
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
              <label className="text-sm font-medium dark:text-gray-300">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                placeholder="8자 이상"
              />
            </div>

            {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gray-900 dark:bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-gray-900 dark:text-gray-100 font-medium underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
