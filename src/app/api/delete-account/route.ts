import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const USER_TABLES = [
  'checklist_items',
  'tasks',
  'columns',
  'projects',
  'calendar_events',
  'posts',
  'activities',
  'contacts',
  'companies',
]

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 토큰으로 유저 확인
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !user) {
    return NextResponse.json({ error: '유효하지 않은 세션' }, { status: 401 })
  }

  // 유저 데이터 삭제 (FK 순서 고려: 자식 테이블 먼저)
  for (const table of USER_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_id', user.id)
    if (error && error.code !== 'PGRST116') {
      console.error(`delete ${table}:`, error.message)
    }
  }

  // Auth 유저 삭제
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
