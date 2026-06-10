import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">My Project Manager</h1>
          <p className="text-gray-500 text-lg">태스크 · 칸반 · 캘린더를 하나로</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-100 transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 transition-colors"
          >
            무료로 시작하기
          </Link>
        </div>
      </div>
    </main>
  )
}
