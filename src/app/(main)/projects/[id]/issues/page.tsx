'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import {
  Plus, X, ChevronLeft, AlertCircle, BookOpen,
  CheckCircle2, Circle, Trash2, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_META } from '@/lib/constants'

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

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const yy  = String(date.getFullYear()).slice(2)
  const mm  = String(date.getMonth() + 1).padStart(2, '0')
  const dd  = String(date.getDate()).padStart(2, '0')
  const hh  = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yy}-${mm}-${dd} ${hh}:${min}`
}

export default function IssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // ── 필터 ──
  const [filter, setFilter] = useState<FilterType>('all')

  // ── 모달 ──
  const [showModal, setShowModal] = useState(false)
  const [editPost, setEditPost] = useState<Post | null>(null)

  // ── 폼 필드 ──
  const [formType, setFormType]         = useState<PostType>('issue')
  const [formTitle, setFormTitle]       = useState('')
  const [formBody, setFormBody]         = useState('')
  const [formPriority, setFormPriority] = useState<PostPriority>('normal')
  const [formError, setFormError]       = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  // ── setup ──
  const [setupNeeded, setSetupNeeded] = useState(false)

  function openNew() {
    setEditPost(null)
    setFormType('issue')
    setFormTitle('')
    setFormBody('')
    setFormPriority('normal')
    setFormError('')
    setShowModal(true)
  }

  function openEdit(post: Post) {
    setEditPost(post)
    setFormType(post.type)
    setFormTitle(post.title)
    setFormBody(post.body ?? '')
    setFormPriority(post.priority)
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditPost(null)
    setFormError('')
  }

  useEffect(() => {
    if (showModal) setTimeout(() => titleRef.current?.focus(), 50)
  }, [showModal])

  // ESC 닫기
  useEffect(() => {
    if (!showModal) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showModal])

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
      closeModal()
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editPost) return
      setFormError('')
      const { error } = await supabase.from('posts').update({
        type: formType,
        title: formTitle.trim(),
        body: formBody.trim() || null,
        priority: formType === 'note' ? 'normal' : formPriority,
        updated_at: new Date().toISOString(),
      }).eq('id', editPost.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
      closeModal()
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

  const isPending = addMutation.isPending || updateMutation.isPending

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
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"

        >
          <Plus size={14} /> 추가
        </button>
      </div>


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

      {/* 목록 */}
      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
            {filter === 'note' ? <BookOpen size={18} className="opacity-50" /> : <AlertCircle size={18} className="opacity-50" />}
          </div>
          <p className="text-sm">항목이 없습니다.</p>
          <button onClick={openNew} className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline">
            새 항목 추가
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filtered.map(post => {
            const isIssue = post.type === 'issue'
            const isOpen  = post.status === 'open'
            const pm = PRIORITY_META[post.priority]

            return (
              <div key={post.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start gap-3 px-5 py-4">
                  {/* 상태 아이콘 */}
                  {isIssue ? (
                    <button
                      onClick={() => toggleStatusMutation.mutate({ postId: post.id, status: isOpen ? 'closed' : 'open' })}
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
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        isIssue
                          ? isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          : 'bg-indigo-100 text-indigo-600'
                      )}>
                        {isIssue ? (isOpen ? '열림' : '닫힘') : '기록'}
                      </span>

                      <span className={cn('text-sm font-medium flex-1 dark:text-gray-200', !isOpen && 'line-through text-gray-400 dark:text-gray-500')}>
                        {post.title}
                      </span>

                      {isIssue && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
                          {pm.label}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {fmtTimestamp(post.created_at)}
                      {post.updated_at !== post.created_at && (
                        <span className="ml-1.5 text-gray-300 dark:text-gray-600">(수정 {fmtTimestamp(post.updated_at)})</span>
                      )}
                    </p>

                    {post.body && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2.5">
                        {post.body}
                      </p>

                    )}
                  </div>

                  {/* 우측 액션 */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button
                      onClick={() => openEdit(post)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="수정"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(post.id) }}
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 모달 ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editPost ? '이슈 / 기록 수정' : '이슈 / 기록 추가'}
              </h2>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* 타입 선택 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFormType('issue')}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all',
                    formType === 'issue' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}
                >
                  <AlertCircle size={13} /> 이슈
                </button>
                <button
                  onClick={() => setFormType('note')}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all',
                    formType === 'note' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}
                >
                  <BookOpen size={13} /> 기록
                </button>
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  제목 <span className="text-red-400">*</span>
                </label>
                <input
                  ref={titleRef}
                  value={formTitle}
                  onChange={e => { setFormTitle(e.target.value); setFormError('') }}
                  placeholder={formType === 'issue' ? '이슈 제목을 입력하세요' : '기록 제목을 입력하세요'}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  내용
                  <span className="ml-1.5 font-normal text-gray-400">(선택 · 추후 파일 첨부 지원 예정)</span>
                </label>
                <textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder={formType === 'issue'
                    ? '발생 상황, 재현 방법, 영향 범위 등을 자세히 적어주세요'
                    : '메모, 회의록, 학습 내용 등을 자유롭게 기록하세요'}
                  rows={8}
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-y min-h-[160px] transition-all"
                />
              </div>

              {/* 우선순위 (이슈만) */}
              {formType === 'issue' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">우선순위</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(Object.keys(PRIORITY_META) as PostPriority[]).map(p => (
                      <button key={p} onClick={() => setFormPriority(p)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                          PRIORITY_META[p].className,
                          formPriority === p ? 'border-gray-500 ring-2 ring-offset-1 ring-gray-300' : 'border-transparent'
                        )}>
                        {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button
                onClick={() => editPost ? updateMutation.mutate() : addMutation.mutate()}
                disabled={!formTitle.trim() || isPending}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending
                  ? '저장 중...'
                  : editPost
                    ? '수정 완료'
                    : formType === 'issue' ? '이슈 등록' : '기록 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
