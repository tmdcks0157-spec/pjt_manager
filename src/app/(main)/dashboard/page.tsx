'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Project, Task } from '@/types'
import { Plus, FolderKanban, Trash2, Pencil, X, AlertCircle, CheckCircle2, Clock, Layers, Archive, ArchiveRestore, ChevronDown, ChevronRight, RotateCcw, Siren, TrendingUp, ArrowDownAZ, ArrowUpDown } from 'lucide-react'
import ConfirmModal, { type ConfirmOptions } from '@/components/ui/ConfirmModal'

type SortOrder = 'created' | 'updated' | 'progress' | 'name'

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'created',  label: '최신순' },
  { key: 'updated',  label: '수정순' },
  { key: 'progress', label: '진행률순' },
  { key: 'name',     label: '이름순' },
]

const PROJECT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6']

function EditProjectModal({ project, onClose, onSave }: {
  project: Project
  onClose: () => void
  onSave: (body: { name: string; description: string; color: string }) => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [color, setColor] = useState(project.color)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-96 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold dark:text-gray-100">프로젝트 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={16} /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="프로젝트 이름"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">색상:</span>
          {PROJECT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full border-2 transition-all"
              style={{ backgroundColor: c, borderColor: color === c ? '#111' : 'transparent' }}
            />
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { onSave({ name, description, color }); onClose() }}
            disabled={!name.trim()}
            className="flex-1 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            저장
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [showArchived, setShowArchived] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('created')

  function openConfirm(options: ConfirmOptions) {
    setConfirmOptions(options)
  }

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const activeProjects = useMemo(() => projects.filter(p => !p.archived && !p.deleted_at), [projects])
  const archivedProjects = useMemo(() => projects.filter(p => p.archived && !p.deleted_at), [projects])
  const deletedProjects = useMemo(() => projects.filter(p => !!p.deleted_at), [projects])

  const { data: allTasks = [] } = useQuery<Pick<Task, 'id' | 'project_id' | 'status' | 'due_date' | 'archived' | 'deleted_at' | 'priority'>[]>({
    queryKey: ['all-tasks-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, status, due_date, archived, deleted_at, priority')
        .is('deleted_at', null)
        .eq('archived', false)
      if (error) throw error
      return (data ?? []) as Pick<Task, 'id' | 'project_id' | 'status' | 'due_date' | 'archived' | 'deleted_at' | 'priority'>[]
    },
  })

  const { data: allColumns = [] } = useQuery<{ id: string; project_id: string; name: string }[]>({
    queryKey: ['all-columns-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('id, project_id, name')
      if (error) throw error
      return (data ?? []) as { id: string; project_id: string; name: string }[]
    },
  })

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const doneColumnIds = new Set(allColumns.filter(c => c.name === '완료').map(c => c.id))

    const total = allTasks.length
    const done = allTasks.filter(t => doneColumnIds.has(t.status)).length
    const overdue = allTasks.filter(t => {
      if (!t.due_date || doneColumnIds.has(t.status)) return false
      const due = new Date(t.due_date); due.setHours(0, 0, 0, 0)
      return due < today
    }).length
    const dueToday = allTasks.filter(t => {
      if (!t.due_date || doneColumnIds.has(t.status)) return false
      const due = new Date(t.due_date); due.setHours(0, 0, 0, 0)
      return due.getTime() === today.getTime()
    }).length

    // allColumns 미로드 시 doneColumnIds가 빈 Set → 완료 태스크가 카운트에 포함되므로 방지
    const colsReady = allColumns.length > 0
    const urgent = colsReady ? allTasks.filter(t => t.priority === 'urgent' && !doneColumnIds.has(t.status)).length : 0
    const high = colsReady ? allTasks.filter(t => t.priority === 'high' && !doneColumnIds.has(t.status)).length : 0

    return { total, done, overdue, dueToday, urgent, high }
  }, [allTasks, allColumns])

  const tasksByProject = useMemo(() => {
    const doneColumnIds = new Set(allColumns.filter(c => c.name === '완료').map(c => c.id))
    const colsReady = allColumns.length > 0
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const map: Record<string, { total: number; done: number; overdue: number; urgent: number }> = {}
    for (const t of allTasks) {
      if (!map[t.project_id]) map[t.project_id] = { total: 0, done: 0, overdue: 0, urgent: 0 }
      map[t.project_id].total++
      const isDone = colsReady && doneColumnIds.has(t.status)
      if (isDone) {
        map[t.project_id].done++
      } else {
        if (t.due_date) {
          const due = new Date(t.due_date); due.setHours(0, 0, 0, 0)
          if (due < today) map[t.project_id].overdue++
        }
        if (colsReady && t.priority === 'urgent') map[t.project_id].urgent++
      }
    }
    return map
  }, [allTasks, allColumns])

  const sortedActiveProjects = useMemo(() => {
    const arr = [...activeProjects]
    switch (sortOrder) {
      case 'updated':
        return arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      case 'progress': {
        const pct = (p: Project) => {
          const ps = tasksByProject[p.id]
          return ps && ps.total > 0 ? ps.done / ps.total : -1
        }
        return arr.sort((a, b) => pct(b) - pct(a))
      }
      case 'name':
        return arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      default:
        return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  }, [activeProjects, sortOrder, tasksByProject])

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; description: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('projects').insert({ ...body, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
      setName('')
      setDescription('')
      setColor(PROJECT_COLORS[0])
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { name: string; description: string; color: string } }) => {
      const { error } = await supabase.from('projects').update(body).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').update({ deleted_at: null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').update({ archived: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').update({ archived: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  function ProjectCard({ project, isArchived = false }: { project: Project; isArchived?: boolean }) {
    const ps = tasksByProject[project.id]
    const total = ps?.total ?? 0
    const done = ps?.done ?? 0
    const overdue = ps?.overdue ?? 0
    const urgent = ps?.urgent ?? 0
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    return (
      <div
        onClick={() => !isArchived && router.push(`/projects/${project.id}`)}
        className={`p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all group relative ${isArchived ? 'opacity-70 cursor-default' : 'hover:shadow-md cursor-pointer'}`}
      >
        <div className="absolute top-4 right-4 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          {!isArchived && (
            <button
              onClick={e => { e.stopPropagation(); setEditingProject(project) }}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="수정"
            >
              <Pencil size={14} />
            </button>
          )}
          {!isArchived ? (
            <button
              onClick={e => {
                e.stopPropagation()
                openConfirm({
                  title: '프로젝트 보관',
                  message: `"${project.name}" 프로젝트를 보관하시겠어요?\n보관된 프로젝트는 하단에서 확인할 수 있습니다.`,
                  confirmText: '보관',
                  onConfirm: () => archiveMutation.mutate(project.id),
                })
              }}
              className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
              title="보관"
            >
              <Archive size={14} />
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); unarchiveMutation.mutate(project.id) }}
              className="p-1 text-gray-400 hover:text-green-500 transition-colors"
              title="보관 해제"
            >
              <ArchiveRestore size={14} />
            </button>
          )}
          <button
            onClick={e => {
              e.stopPropagation()
              openConfirm({
                title: '휴지통으로 이동',
                message: `"${project.name}" 프로젝트를 휴지통으로 이동하시겠어요?`,
                confirmText: '이동',
                onConfirm: () => softDeleteMutation.mutate(project.id),
              })
            }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="휴지통으로 이동"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          {isArchived && (
            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">보관됨</span>
          )}
          {!isArchived && urgent > 0 && (
            <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Siren size={10} />긴급 {urgent}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-sm mb-1 truncate pr-12 dark:text-gray-100">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-3">{project.description}</p>
        )}

        {total > 0 && (
          <div className="mt-3 space-y-2">
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: project.color }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">{done}/{total} 완료</span>
              <div className="flex items-center gap-2">
                {overdue > 0 && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
                    <AlertCircle size={11} />
                    {overdue}
                  </span>
                )}
                <span className="text-xs text-gray-400">{pct}%</span>
              </div>
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="text-xs text-gray-300 mt-3">태스크 없음</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {confirmOptions && (
        <ConfirmModal options={confirmOptions} onClose={() => setConfirmOptions(null)} />
      )}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={body => updateMutation.mutate({ id: editingProject.id, body })}
        />
      )}

      {/* 상단 요약 카드 */}
      {allTasks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <Layers size={16} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none dark:text-gray-100">{stats.total}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">전체</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none dark:text-gray-100">{stats.done}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">완료</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Clock size={16} className="text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none dark:text-gray-100">{stats.dueToday}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">오늘 마감</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertCircle size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none dark:text-gray-100">{stats.overdue}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">기한 초과</p>
            </div>
          </div>
          <div className={`border rounded-xl p-4 flex items-center gap-3 ${stats.urgent > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stats.urgent > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Siren size={16} className={stats.urgent > 0 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'} />
            </div>
            <div>
              <p className={`text-2xl font-bold leading-none ${stats.urgent > 0 ? 'text-red-600 dark:text-red-400' : 'dark:text-gray-100'}`}>{stats.urgent}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">긴급</p>
            </div>
          </div>
          <div className={`border rounded-xl p-4 flex items-center gap-3 ${stats.high > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stats.high > 0 ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <TrendingUp size={16} className={stats.high > 0 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'} />
            </div>
            <div>
              <p className={`text-2xl font-bold leading-none ${stats.high > 0 ? 'text-orange-600 dark:text-orange-400' : 'dark:text-gray-100'}`}>{stats.high}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">높음</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-xl font-bold mr-auto dark:text-gray-100">프로젝트</h1>
        <div className="flex items-center gap-1">
          <ArrowUpDown size={13} className="text-gray-400 mr-0.5" />
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortOrder(opt.key)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                sortOrder === opt.key
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <Plus size={16} />
          새 프로젝트
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 space-y-4">
          <h2 className="font-semibold text-sm text-gray-700 dark:text-gray-300">새 프로젝트 만들기</h2>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="프로젝트 이름"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">색상:</span>
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: color === c ? '#111' : 'transparent' }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate({ name, description, color })}
              disabled={!name || createMutation.isPending}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              만들기
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : activeProjects.length === 0 && archivedProjects.length === 0 && deletedProjects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">프로젝트가 없습니다. 새 프로젝트를 만들어보세요!</p>
        </div>
      ) : (
        <>
          {activeProjects.length === 0 ? (
            <p className="text-gray-400 text-sm mb-6">활성 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedActiveProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          {/* 보관된 프로젝트 섹션 */}
          {archivedProjects.length > 0 && (
            <div className="mt-10">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-4"
              >
                {showArchived ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Archive size={14} />
                보관된 프로젝트
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{archivedProjects.length}</span>
              </button>
              {showArchived && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivedProjects.map(project => (
                    <ProjectCard key={project.id} project={project} isArchived />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 휴지통 섹션 */}
          {deletedProjects.length > 0 && (
            <div className="mt-10">
              <button
                onClick={() => setShowTrash(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-4"
              >
                {showTrash ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Trash2 size={14} />
                휴지통
                <span className="text-xs bg-red-50 dark:bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full">{deletedProjects.length}</span>
              </button>
              {showTrash && (
                <div className="space-y-2">
                  {deletedProjects.map(project => (
                    <div key={project.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 opacity-50" style={{ backgroundColor: project.color }} />
                        <span className="text-sm text-gray-400 dark:text-gray-500 truncate line-through">{project.name}</span>
                        {project.description && (
                          <span className="text-xs text-gray-300 dark:text-gray-600 truncate hidden sm:block">{project.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <button
                          onClick={() => restoreMutation.mutate(project.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <RotateCcw size={13} />
                          복구
                        </button>
                        <button
                          onClick={() => openConfirm({
                            title: '프로젝트 영구 삭제',
                            message: `"${project.name}" 프로젝트를 영구 삭제하시겠어요?\n모든 태스크와 데이터가 삭제되며 복구할 수 없습니다.`,
                            confirmText: '영구 삭제',
                            danger: true,
                            onConfirm: () => permanentDeleteMutation.mutate(project.id),
                          })}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={13} />
                          영구삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
