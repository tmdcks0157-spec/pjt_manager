'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import {
  Plus, X, ChevronLeft, AlertCircle, BookOpen,
  CheckCircle2, Circle, Trash2, Pencil, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_META } from '@/lib/constants'
import { useContacts } from '@/hooks/useCRM'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownViewer from '@/components/ui/MarkdownViewer'

type PostType = 'issue' | 'note'
type IssueStatus = 'open' | 'closed'
type PostPriority = 'low' | 'normal' | 'high' | 'urgent'
type FilterType = 'all' | 'open' | 'closed' | 'note'

interface Post {
  id: string
  user_id: string
  project_id: string
  contact_id: string | null
  type: PostType
  title: string
  body: string | null
  status: IssueStatus
  priority: PostPriority
  tags: string[]
  recorded_at: string | null
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

function nowLocalISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const yy  = date.getFullYear()
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

  const [filter, setFilter] = useState<FilterType>('all')
  const [showModal, setShowModal] = useState(false)
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [modalSize, setModalSize] = useState<'md' | 'lg' | 'xl'>(() =>
    (typeof window !== 'undefined'
      ? (localStorage.getItem('issues-modal-size') as 'md' | 'lg' | 'xl')
      : null) ?? 'lg'
  )

  function cycleModalSize() {
    const next = modalSize === 'md' ? 'lg' : modalSize === 'lg' ? 'xl' : 'md'
    setModalSize(next)
    localStorage.setItem('issues-modal-size', next)
  }

  const modalWidthClass = modalSize === 'md' ? 'max-w-2xl' : modalSize === 'lg' ? 'max-w-3xl' : 'max-w-5xl'

  const [formType, setFormType]           = useState<PostType>('issue')
  const [formTitle, setFormTitle]         = useState('')
  const [formBody, setFormBody]           = useState('')
  const [formPriority, setFormPriority]   = useState<PostPriority>('normal')
  const [formContactId, setFormContactId] = useState('')
  const [formRecordedAt, setFormRecordedAt] = useState(nowLocalISO())
  const [formError, setFormError]         = useState('')
  const [formTags, setFormTags]           = useState<string[]>([])
  const [tagInput, setTagInput]           = useState('')
  const [tagFilter, setTagFilter]         = useState<string | null>(null)
  const titleRef   = useRef<HTMLInputElement>(null)

  const [setupNeeded, setSetupNeeded] = useState(false)

  const { data: contacts = [] } = useContacts()

  function openNew() {
    setEditPost(null)
    setFormType('issue')
    setFormTitle('')
    setFormBody('')
    setFormPriority('normal')
    setFormContactId('')
    setFormRecordedAt(nowLocalISO())
    setFormError('')
    setFormTags([])
    setTagInput('')
    setShowModal(true)
  }

  function openEdit(post: Post) {
    setEditPost(post)
    setFormType(post.type)
    setFormTitle(post.title)
    setFormBody(post.body ?? '')
    setFormPriority(post.priority)
    setFormContactId(post.contact_id ?? '')
    setFormRecordedAt(post.recorded_at ? post.recorded_at.slice(0, 16) : nowLocalISO())
    setFormError('')
    setFormTags(post.tags ?? [])
    setTagInput('')
    setShowModal(true)
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[,\s]+/g, '-').replace(/[^a-z0-9가-힣\-]/g, '')
    if (tag && !formTags.includes(tag)) setFormTags(prev => [...prev, tag])
    setTagInput('')
  }

  function closeModal() {
    setShowModal(false)
    setEditPost(null)
    setFormError('')
  }

  useEffect(() => {
    if (showModal) {
      setTimeout(() => { titleRef.current?.focus() }, 50)
    }
  }, [showModal])

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
        .order('recorded_at', { ascending: false, nullsFirst: false })
      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('posts')) {
          setSetupNeeded(true); return []
        }
        // recorded_at 컬럼 없으면 created_at 기준으로 fallback
        if (error.code === '42703') {
          const { data: d2, error: e2 } = await supabase
            .from('posts').select('*').eq('project_id', id)
            .order('created_at', { ascending: false })
          if (e2) throw e2
          return (d2 ?? []).map(p => ({ ...p, recorded_at: null }))
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
        contact_id: formContactId || null,
        recorded_at: formRecordedAt ? new Date(formRecordedAt).toISOString() : new Date().toISOString(),
        tags: formTags,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['posts', id] }); closeModal() },
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
        contact_id: formContactId || null,
        recorded_at: formRecordedAt ? new Date(formRecordedAt).toISOString() : null,
        updated_at: new Date().toISOString(),
        tags: formTags,
      }).eq('id', editPost.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['posts', id] }); closeModal() },
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

  // 연락처 맵
  const contactsMap = Object.fromEntries(contacts.map(c => [c.id, c]))

  const issues = posts.filter(p => p.type === 'issue')
  const notes  = posts.filter(p => p.type === 'note')
  const openCount   = issues.filter(i => i.status === 'open').length
  const closedCount = issues.filter(i => i.status === 'closed').length

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags ?? []))).sort()

  const filtered = posts.filter(p => {
    const typeOk = (() => {
      if (filter === 'all')    return true
      if (filter === 'open')   return p.type === 'issue' && p.status === 'open'
      if (filter === 'closed') return p.type === 'issue' && p.status === 'closed'
      if (filter === 'note')   return p.type === 'note'
      return true
    })()
    const tagOk = !tagFilter || (p.tags ?? []).includes(tagFilter)
    return typeOk && tagOk
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
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors">
          <Plus size={14} /> 추가
        </button>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
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

      {/* 태그 필터 pills */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          {tagFilter && (
            <button onClick={() => setTagFilter(null)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              <X size={9} /> 태그 해제
            </button>
          )}
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={cn(
                'px-2 py-1 rounded-full text-[10px] font-medium border transition-all',
                tagFilter === tag
                  ? 'bg-violet-600 text-white border-transparent'
                  : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40'
              )}>
              # {tag}
            </button>
          ))}
        </div>
      )}

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
            const linkedContact = post.contact_id ? contactsMap[post.contact_id] : null
            const displayTime = post.recorded_at ?? post.created_at

            return (
              <div key={post.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start gap-3 px-5 py-4">
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
                      <span className={cn('text-sm font-medium flex-1 dark:text-gray-200', !isOpen && isIssue && 'line-through text-gray-400 dark:text-gray-500')}>
                        {post.title}
                      </span>
                      {isIssue && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
                          {pm.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {fmtTimestamp(displayTime)}
                        {post.updated_at !== post.created_at && (
                          <span className="ml-1.5 text-gray-300 dark:text-gray-600">(수정 {fmtTimestamp(post.updated_at)})</span>
                        )}
                      </p>
                      {linkedContact && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-medium">
                          <Users size={9} /> {linkedContact.name}
                        </span>
                      )}
                    </div>

                    {post.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.tags.map(tag => (
                          <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                            className={cn(
                              'px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                              tagFilter === tag
                                ? 'bg-violet-600 text-white'
                                : 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100'
                            )}>
                            # {tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {post.body && (
                      <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5">
                        <MarkdownViewer content={post.body} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button onClick={() => openEdit(post)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="수정">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(post.id) }}
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="삭제">
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
          <div className={cn('bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] transition-all duration-200', modalWidthClass)}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {editPost ? '이슈 / 기록 수정' : '이슈 / 기록 추가'}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={cycleModalSize}
                  title={`모달 크기 전환 (현재: ${modalSize === 'md' ? '소' : modalSize === 'lg' ? '중' : '대'})`}
                  className="px-2 py-1 text-[10px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {modalSize === 'md' ? '소' : modalSize === 'lg' ? '중' : '대'}
                </button>
                <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* 타입 */}
              <div className="flex gap-2">
                <button onClick={() => setFormType('issue')}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all',
                    formType === 'issue' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400')}>
                  <AlertCircle size={13} /> 이슈
                </button>
                <button onClick={() => setFormType('note')}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all',
                    formType === 'note' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400')}>
                  <BookOpen size={13} /> 기록
                </button>
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  제목 <span className="text-red-400">*</span>
                </label>
                <input
                  ref={titleRef}
                  value={formTitle}
                  onChange={e => { setFormTitle(e.target.value); setFormError('') }}
                  placeholder={formType === 'issue' ? '이슈 제목을 입력하세요' : '기록 제목을 입력하세요'}
                  maxLength={200}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                />
              </div>

              {/* 날짜/시간 + 연락처 (2열) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    날짜 / 시간
                  </label>
                  <input
                    type="datetime-local"
                    value={formRecordedAt}
                    onChange={e => setFormRecordedAt(e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    연락처 연결
                  </label>
                  <select
                    value={formContactId}
                    onChange={e => setFormContactId(e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                  >
                    <option value="">연결 안 함</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.company ? ` · ${c.company.name}` : ''}{c.role ? ` (${c.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">내용</label>
                <MarkdownEditor
                  key={editPost?.id ?? 'new'}
                  defaultValue={formBody}
                  onChange={setFormBody}
                  placeholder={formType === 'issue'
                    ? '발생 상황, 재현 방법, 영향 범위 등을 자세히 적어주세요'
                    : '메모, 회의록, 학습 내용 등을 자유롭게 기록하세요'}
                />
              </div>

              {/* 태그 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">태그</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                      # {tag}
                      <button type="button" onClick={() => setFormTags(prev => prev.filter(t => t !== tag))} className="hover:text-red-500 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                  }}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                  placeholder="태그 입력 후 Enter (예: 버그, 긴급)"
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                />
              </div>

              {/* 우선순위 (이슈만) */}
              {formType === 'issue' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">우선순위</label>
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
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={closeModal}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                취소
              </button>
              <button
                onClick={() => editPost ? updateMutation.mutate() : addMutation.mutate()}
                disabled={!formTitle.trim() || isPending}
                className="px-5 py-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? '저장 중...' : editPost ? '수정 완료' : formType === 'issue' ? '이슈 등록' : '기록 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
