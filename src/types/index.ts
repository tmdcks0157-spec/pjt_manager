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
  contact_id?: string | null
  assignee_name?: string | null
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
  contact_id?: string | null
  type: 'issue' | 'note'
  title: string
  body?: string | null
  status: 'open' | 'closed'
  priority: string
  tags: string[]
  created_at: string
}

export interface Company {
  id: string
  user_id: string
  name: string
  industry: string | null
  website: string | null
  phone: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  company_id: string | null
  company?: Company
  name: string
  email: string | null
  phones: string[]
  role: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note'

export interface Activity {
  id: string
  user_id: string
  contact_id: string
  type: ActivityType
  title: string
  body: string | null
  activity_date: string
  created_at: string
}
