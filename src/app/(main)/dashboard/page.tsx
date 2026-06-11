'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Project, Task } from '@/types'
import { Plus, FolderKanban, Trash2, Pencil, X, AlertCircle, CheckCircle2, Clock, Layers } from 'lucide-react'

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
      <div className="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">프로젝트 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="프로젝트 이름"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">색상:</span>
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
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors"
          >
            저장
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: allTasks = [] } = useQuery<Pick<Task, 'id' | 'project_id' | 'status' | 'due_date' | 'archived' | 'deleted_at'>[]>({
    queryKey: ['all-tasks-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, status, due_date, archived, deleted_at')
        .is('deleted_at', null)
        .eq('archived', false)
      if (error) throw error
      return (data ?? []) as Pick<Task, 'id' | 'project_id' | 'status' | 'due_date' | 'archived' | 'deleted_at'>[]
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

    return { total, done, overdue, dueToday }
  }, [allTasks, allColumns])

  const tasksByProject = useMemo(() => {
    const doneColumnIds = new Set(allColumns.filter(c => c.name === '완료').map(c => c.id))
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const map: Record<string, { total: number; done: number; overdue: number }> = {}
    for (const t of allTasks) {
      if (!map[t.project_id]) map[t.project_id] = { total: 0, done: 0, overdue: 0 }
      map[t.project_id].total++
      if (doneColumnIds.has(t.status)) {
        map[t.project_id].done++
      } else if (t.due_date) {
        const due = new Date(t.due_date); due.setHours(0, 0, 0, 0)
        if (due < today) map[t.project_id].overdue++
      }
    }
    return map
  }, [allTasks, allColumns])

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={body => updateMutation.mutate({ id: editingProject.id, body })}
        />
      )}

      {/* 상단 요약 카드 */}
      {allTasks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Layers size={16} className="text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-1">전체 태스크</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.done}</p>
              <p className="text-xs text-gray-400 mt-1">완료</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Clock size={16} className="text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.dueToday}</p>
              <p className="text-xs text-gray-400 mt-1">오늘 마감</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <AlertCircle size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.overdue}</p>
              <p className="text-xs text-gray-400 mt-1">기한 초과</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">프로젝트</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <Plus size={16} />
          새 프로젝트
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-5 border border-gray-200 rounded-xl bg-white space-y-4">
          <h2 className="font-semibold text-sm text-gray-700">새 프로젝트 만들기</h2>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="프로젝트 이름"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">색상:</span>
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
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors"
            >
              만들기
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">프로젝트가 없습니다. 새 프로젝트를 만들어보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => {
            const ps = tasksByProject[project.id]
            const total = ps?.total ?? 0
            const done = ps?.done ?? 0
            const overdue = ps?.overdue ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md cursor-pointer transition-all group relative"
              >
                <div className="absolute top-4 right-4 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingProject(project) }}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm('프로젝트를 삭제하시겠어요?')) deleteMutation.mutate(project.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: project.color }} />
                <h3 className="font-semibold text-sm mb-1 truncate pr-12">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-gray-400 truncate mb-3">{project.description}</p>
                )}

                {total > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: project.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{done}/{total} 완료</span>
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
          })}
        </div>
      )}
    </div>
  )
}
