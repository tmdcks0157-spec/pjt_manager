'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { LayoutDashboard, CalendarDays, Users, BarChart2 } from 'lucide-react'

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

          {/* 하단 태그라인 */}
          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              개인 사용을 위해 설계된 올인원 생산성 도구
            </p>
          </div>
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
