'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import {
  Plus, X, ChevronLeft, AlertCircle, BookOpen,
  CheckCircle2, Circle, Trash2, CalendarDays, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type PostType = 'issue' | 'note'
type IssueStatus = 'open' | 'closed'
type PostPriority = 'low' | 'normal' | 'high' | 'urgent'
type FilterType = 'all' | 'open' | 'closed' | 'note'

interface Post {
  id: string
  user_id: string
  project_id: string
  type: PostType
  title: string
  body: string | null
  status: IssueStatus
  priority: PostPriority
  created_at: string
  updated_at: string
}

const PRIORITY_META: Record<PostPriority, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

const SETUP_SQL = `-- Supabase SQL Editor에서 실행해주세요
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'issue' CHECK (type IN ('issue', 'note')),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own posts"
  ON posts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function IssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // ── 필터 ──
  const [filter, setFilter] = useState<FilterType>('all')

  // ── 인라인 폼 ──
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<PostType>('issue')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formPriority, setFormPriority] = useState<PostPriority>('normal')
  const [formError, setFormError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  // ── 확장 ──
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── setup ──
  const [setupNeeded, setSetupNeeded] = useState(false)

  useEffect(() => {
    if (showForm) setTimeout(() => titleRef.current?.focus(), 50)
  }, [showForm])

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ['posts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts').select('*').eq('project_id', id)
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('posts')) {
          setSetupNeeded(true); return []
        }
        throw error
      }
      setSetupNeeded(false)
      return data
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      setFormError('')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        project_id: id,
        type: formType,
        title: formTitle.trim(),
        body: formBody.trim() || null,
        priority: formType === 'note' ? 'normal' : formPriority,
        status: 'open',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
      setFormTitle(''); setFormBody(''); setFormPriority('normal'); setShowForm(false)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: IssueStatus }) => {
      const { error } = await supabase.from('posts').update({ status }).eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', id] }),
  })

  const issues = posts.filter(p => p.type === 'issue')
  const notes  = posts.filter(p => p.type === 'note')
  const openCount   = issues.filter(i => i.status === 'open').length
  const closedCount = issues.filter(i => i.status === 'closed').length

  const filtered = posts.filter(p => {
    if (filter === 'all')    return true
    if (filter === 'open')   return p.type === 'issue' && p.status === 'open'
    if (filter === 'closed') return p.type === 'issue' && p.status === 'closed'
    if (filter === 'note')   return p.type === 'note'
    return true
  })

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',    label: '전체',      count: posts.length },
    { key: 'open',   label: '열린 이슈', count: openCount },
    { key: 'closed', label: '닫힌 이슈', count: closedCount },
    { key: 'note',   label: '기록',      count: notes.length },
  ]

  if (setupNeeded) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <button onClick={() => router.push(`/projects/${id}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 mb-6 transition-colors">
          <ChevronLeft size={16} /> 칸반 보드로
        </button>
        <h1 className="text-2xl font-bold mb-4 dark:text-gray-100">이슈 & 기록</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-700 font-semibold">
            <AlertCircle size={16} /> 초기 설정이 필요합니다
          </div>
          <p className="text-sm text-amber-700">Supabase SQL Editor에서 아래 SQL을 실행해 posts 테이블을 생성해주세요.</p>
          <pre className="bg-white border border-amber-200 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-auto whitespace-pre-wrap">{SETUP_SQL}</pre>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['posts', id] })}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
            설정 완료 후 새로고침
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/projects/${id}`)}
          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ChevronLeft size={16} />
        </button>
        {project && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
        <h1 className="text-lg font-bold flex-1 truncate dark:text-gray-100">{project?.name ?? '...'} — 이슈 & 기록</h1>
        <button
          onClick={() => { setShowForm(v => !v); setFormError('') }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            showForm ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'bg-gray-900 text-white hover:bg-gray-700'
          )}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? '닫기' : '추가'}
        </button>
      </div>

      {/* 인라인 추가 폼 */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-6 space-y-4">
          {/* 타입 선택 */}
          <div className="flex gap-2">
            <button onClick={() => setFormType('issue')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                formType === 'issue' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400')}>
              <AlertCircle size={12} /> 이슈
            </button>
            <button onClick={() => setFormType('note')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                formType === 'note' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400')}>
              <BookOpen size={12} /> 기록
            </button>
          </div>

          {/* 제목 */}
          <input
            ref={titleRef}
            value={formTitle}
            onChange={e => { setFormTitle(e.target.value); setFormError('') }}
            onKeyDown={e => { if (e.key === 'Enter' && formTitle.trim()) addMutation.mutate() }}
            placeholder={formType === 'issue' ? '이슈 제목 (필수)' : '기록 제목 (필수)'}
            className="w-full text-sm font-semibold focus:outline-none border-b-2 border-gray-200 dark:border-gray-600 focus:border-gray-800 dark:focus:border-gray-400 pb-1.5 transition-colors bg-transparent dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          {/* 내용 */}
          <textarea
            value={formBody}
            onChange={e => setFormBody(e.target.value)}
            placeholder={formType === 'issue' ? '상세 내용 (선택)' : '내용 입력...'}
            rows={3}
            className="w-full text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
          />

          {/* 우선순위 (이슈만) */}
          {formType === 'issue' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 dark:text-gray-500">우선순위</span>
              {(Object.keys(PRIORITY_META) as PostPriority[]).map(p => (
                <button key={p} onClick={() => setFormPriority(p)}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2',
                    PRIORITY_META[p].className,
                    formPriority === p ? 'border-gray-500' : 'border-transparent')}>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          )}

          {/* 에러 + 액션 */}
          {formError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{formTitle.trim() ? '' : '제목을 입력해주세요'}</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setFormTitle(''); setFormBody(''); setFormError('') }}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">
                취소
              </button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!formTitle.trim() || addMutation.isPending}
                className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {addMutation.isPending ? '저장 중...' : formType === 'issue' ? '이슈 등록' : '기록 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              filter === f.key
                ? 'bg-gray-900 text-white border-transparent'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            )}>
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              )}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 통합 피드 */}
      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
            {filter === 'note' ? <BookOpen size={18} className="opacity-50" /> : <AlertCircle size={18} className="opacity-50" />}
          </div>
          <p className="text-sm">항목이 없습니다.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline">
            새 항목 추가
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filtered.map(post => {
            const isIssue = post.type === 'issue'
            const isOpen  = post.status === 'open'
            const pm = PRIORITY_META[post.priority]
            const isExpanded = expandedId === post.id

            return (
              <div key={post.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start gap-3 px-5 py-4">
                  {/* 상태 아이콘 */}
                  {isIssue ? (
                    <button
                      onClick={() => toggleStatusMutation.mutate({
                        postId: post.id,
                        status: isOpen ? 'closed' : 'open',
                      })}
                      className="mt-0.5 shrink-0 transition-colors"
                      title={isOpen ? '이슈 닫기' : '이슈 다시 열기'}
                    >
                      {isOpen
                        ? <Circle size={16} className="text-green-500 hover:text-green-700" />
                        : <CheckCircle2 size={16} className="text-gray-400 hover:text-gray-600" />}
                    </button>
                  ) : (
                    <BookOpen size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                  )}

                  {/* 본문 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 타입 레이블 */}
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        isIssue
                          ? isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          : 'bg-indigo-100 text-indigo-600'
                      )}>
                        {isIssue ? (isOpen ? '열림' : '닫힘') : '기록'}
                      </span>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : post.id)}
                        className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 text-left flex-1"
                      >
                        {post.title}
                      </button>

                      {isIssue && post.priority !== 'normal' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
                          {pm.label}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                      <CalendarDays size={10} />
                      {fmtDate(post.created_at)}
                    </p>

                    {/* 미리보기 (접혀 있을 때) */}
                    {!isExpanded && post.body && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-1">{post.body}</p>
                    )}

                    {/* 펼쳐진 본문 */}
                    {isExpanded && post.body && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2.5">{post.body}</p>
                    )}
                  </div>

                  {/* 우측 액션 */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    {post.body && (
                      <button onClick={() => setExpandedId(isExpanded ? null : post.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                    <button onClick={() => deleteMutation.mutate(post.id)}
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
