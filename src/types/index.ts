export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  color: string
  archived: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectColumn {
  id: string
  project_id: string
  user_id: string
  name: string
  color: string
  order: number
  wip_limit: number | null
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskType = 'task' | 'meeting'

export interface Task {
  id: string
  project_id: string
  user_id: string
  title: string
  description: string
  status: string        // column id (UUID)
  priority: TaskPriority
  due_date: string | null
  tags: string[]
  notes: string
  task_type: TaskType
  order: number
  archived: boolean
  deleted_at: string | null
  checklist_items?: ChecklistItem[]
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  task_id: string
  user_id: string
  text: string
  completed: boolean
  order: number
  created_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  date: string
  end_date: string | null
  color: string
  description: string
  created_at: string
}

export interface User {
  _id: string
  email: string
  name?: string
}

export interface Post {
  id: string
  project_id: string
  type: 'issue' | 'note'
  title: string
  body?: string | null
  status: 'open' | 'closed'
  priority: string
  created_at: string
}
