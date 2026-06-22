import { supabase } from './supabase'

/**
 * 현재 로그인한 사용자의 id를 반환한다.
 * 세션이 없거나 만료된 경우 `user!.id` 처럼 조용히 크래시하는 대신
 * 명확한 에러를 던지고 로그인 페이지로 유도한다.
 *
 * INSERT/UPDATE mutation 등 user_id가 반드시 필요한 곳에서 사용한다.
 */
export async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.')
  }
  return user.id
}
