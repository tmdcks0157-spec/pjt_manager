'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.toLowerCase() : ''
      if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
        setError('잠시 후 다시 시도해주세요. (1분에 1회 발송 가능)')
      } else {
        setError('메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
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

        {sent ? (
          <div className="text-center space-y-3 py-8">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Mail size={22} className="text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold dark:text-gray-100">메일을 확인해주세요</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>으로<br />
              비밀번호 재설정 링크를 보냈습니다.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">
              메일이 오지 않으면 스팸 폴더를 확인해주세요.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold dark:text-gray-100">비밀번호 찾기</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium dark:text-gray-300">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                  placeholder="you@example.com"
                />
              </div>

              {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gray-900 dark:bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {loading ? '발송 중...' : '재설정 링크 보내기'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
