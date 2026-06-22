'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, CalendarDays, Users, BarChart2, ArrowRight } from 'lucide-react'

const FEATURES = [
  {
    icon: LayoutDashboard,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    title: '칸반 보드',
    desc: '프로젝트를 컬럼과 카드로 시각화해 진행 상황을 한눈에 파악',
  },
  {
    icon: CalendarDays,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    title: '캘린더',
    desc: '마감일과 일정을 월별·주별로 확인하고 충돌을 사전에 방지',
  },
  {
    icon: Users,
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    title: 'CRM',
    desc: '연락처·회사·활동 이력을 체계적으로 기록하고 관계를 관리',
  },
  {
    icon: BarChart2,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    title: '주간 리포트',
    desc: '완료된 태스크와 생산성 패턴을 자동으로 집계해 인사이트 제공',
  },
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
      <div className="hidden lg:flex flex-col justify-center px-16 flex-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-950 dark:to-gray-900 border-r border-gray-100 dark:border-gray-800">
        <div className="max-w-sm">
          {/* 로고 */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-gray-100 flex items-center justify-center">
              <LayoutDashboard size={18} className="text-white dark:text-gray-900" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">My PM</span>
          </div>

          {/* 헤드라인 */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-2">
            일 잘하는 사람들의<br />개인 프로젝트 관리 도구
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
            할 일, 일정, 연락처, 리포트까지 —<br />흩어진 업무를 한 곳에서 관리하세요.
          </p>

          {/* 기능 목록 */}
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <li key={title} className="flex items-start gap-3.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* 소개 페이지 유도 버튼 */}
          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800">
            <a
              href="/landing.html"
              className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all group"
            >
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">기능 자세히 살펴보기</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">칸반 · 캘린더 · CRM · 리포트 미리보기</p>
              </div>
              <ArrowRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform shrink-0" />
            </a>
          </div>
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
