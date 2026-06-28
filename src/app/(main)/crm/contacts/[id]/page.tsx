'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Mail, Globe, Tag,
  Plus, Edit2, Trash2, CheckCircle2, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContact, useDeleteContact, useCompanies } from '@/hooks/useCRM'
import { useActivities } from '@/hooks/useActivities'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import ActivityTimeline from '@/components/crm/ActivityTimeline'
import ActivityForm from '@/components/crm/ActivityForm'
import ContactForm from '@/components/crm/ContactForm'
import TaskModal from '@/components/kanban/TaskModal'
import { useAllColumns } from '@/hooks/useAllColumns'
import type { Post, Task } from '@/types'

type Tab = 'activities' | 'posts' | 'tasks'

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('activities')
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const { data: contact, isLoading } = useContact(id)
  const { data: activities = [] } = useActivities(id)
  const { data: companies = [] } = useCompanies()
  const deleteContact = useDeleteContact()
  const { data: columns = [] } = useAllColumns()

  const doneColIds = useMemo(
    () => new Set(columns.filter(c => c.name === '완료').map(c => c.id)),
    [columns]
  )

  // 연결된 posts (이슈&기록)
  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['contact-posts', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42703') return []
        throw error
      }
      return data ?? []
    },
  })

  // 연결된 tasks (칸반)
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['contact-tasks', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .contains('contact_ids', [id])
        .is('deleted_at', null)
        .eq('archived', false)
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42703') return []
        throw error
      }
      return data ?? []
    },
  })

  async function handleDelete() {
    if (!confirm('이 연락처를 삭제할까요?')) return
    await deleteContact.mutateAsync(id)
    router.push('/crm')
  }

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-gray-400 dark:text-gray-500">불러오는 중...</div>
    )
  }

  if (!contact) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">연락처를 찾을 수 없습니다.</p>
        <Link href="/crm" className="text-xs text-blue-500 hover:underline mt-2 block">← 연락처 목록</Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* 뒤로 */}
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6">
        <ArrowLeft size={13} /> 연락처 목록
      </Link>

      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{contact.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {[contact.company?.name, contact.role].filter(Boolean).join(' · ') || '개인'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowEditForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Edit2 size={12} /> 편집
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 size={12} /> 삭제
            </button>
          </div>
        </div>

        {/* 연락처 정보 */}
        <div className="flex flex-wrap gap-3 mb-4">
          {contact.email && (
            <a href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Mail size={13} /> {contact.email}
            </a>
          )}
          {contact.phones?.map((phone, i) => (
            <a key={i} href={`tel:${phone}`}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              <Phone size={13} /> {phone}
            </a>
          ))}
          {contact.company?.website && (
            <a href={contact.company.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Globe size={13} /> 회사 홈페이지
            </a>
          )}
        </div>

        {/* 태그 */}
        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {contact.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                <Tag size={9} /> {tag}
              </span>
            ))}
          </div>
        )}

        {/* 메모 */}
        {contact.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 mb-4 whitespace-pre-wrap">
            {contact.notes}
          </p>
        )}

      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
        {([
          ['activities', `활동 타임라인`, activities.length],
          ['posts', `이슈 & 기록`, posts.length],
          ['tasks', `연결된 태스크`, tasks.length],
        ] as [Tab, string, number][]).map(([t, label, count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}>
            {label} {count > 0 && <span className="ml-1 text-gray-400 dark:text-gray-500">{count}</span>}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
        {tab === 'activities' && (
          <>
            {!showActivityForm && (
              <button
                onClick={() => setShowActivityForm(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-4 hover:border-gray-400 dark:hover:border-gray-500 transition-colors w-full"
              >
                <Plus size={13} /> 활동 기록 추가
              </button>
            )}
            {showActivityForm && (
              <ActivityForm contactId={id} onClose={() => setShowActivityForm(false)} />
            )}
            <ActivityTimeline activities={activities} />
          </>
        )}

        {tab === 'posts' && (
          posts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-sm">연결된 이슈 & 기록이 없습니다</p>
              <p className="text-xs mt-1">이슈&기록 페이지에서 이 연락처를 연결할 수 있습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map(post => (
                <div key={post.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5',
                    post.type === 'issue' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}>
                    {post.type === 'issue' ? '이슈' : '노트'}
                  </span>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{post.title}</p>
                  <span className={cn('ml-auto text-[10px] shrink-0',
                    post.status === 'open' ? 'text-green-500' : 'text-gray-400'
                  )}>
                    {post.status === 'open' ? '열림' : '닫힘'}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'tasks' && (
          tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-sm">연결된 태스크가 없습니다</p>
              <p className="text-xs mt-1">칸반보드에서 태스크를 이 연락처에 연결할 수 있습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => {
                const isDone = doneColIds.has(task.status)
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <CheckCircle2 className={cn('w-4 h-4 shrink-0', isDone ? 'text-green-500' : 'text-gray-300 dark:text-gray-600')} />
                    <p className={cn('flex-1 text-sm', isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200')}>
                      {task.title}
                    </p>
                    {task.due_date && (
                      <span className="text-[10px] text-gray-400 shrink-0">{task.due_date.slice(0, 10)}</span>
                    )}
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 transition-opacity" />
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {showEditForm && (
        <ContactForm
          companies={companies}
          contact={contact}
          onClose={() => setShowEditForm(false)}
        />
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
