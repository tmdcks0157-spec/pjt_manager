'use client'

import { useState } from 'react'
import { X, Plus, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateContact, useUpdateContact } from '@/hooks/useCRM'
import type { Company, Contact } from '@/types'

interface Props {
  companies: Company[]
  contact?: Contact
  defaultCompanyId?: string
  onClose: () => void
}

export default function ContactForm({ companies, contact, defaultCompanyId, onClose }: Props) {
  const [name, setName]           = useState(contact?.name ?? '')
  const [email, setEmail]         = useState(contact?.email ?? '')
  const [phones, setPhones]       = useState<string[]>(
    contact?.phones?.length ? contact.phones : ['']
  )
  const [role, setRole]           = useState(contact?.role ?? '')
  const [companyId, setCompanyId] = useState(contact?.company_id ?? defaultCompanyId ?? '')
  const [notes, setNotes]         = useState(contact?.notes ?? '')
  const [tags, setTags]           = useState<string[]>(contact?.tags ?? [])
  const [tagInput, setTagInput]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')

  const createContact = useCreateContact()
  const updateContact = useUpdateContact()

  function addPhone() { setPhones(p => [...p, '']) }
  function removePhone(i: number) { setPhones(p => p.filter((_, idx) => idx !== i)) }
  function updatePhone(i: number, val: string) {
    setPhones(p => p.map((v, idx) => idx === i ? val : v))
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags(p => [...p, t])
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setErrorMsg('')
    const emailTrimmed = email.trim()
    if (emailTrimmed) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailTrimmed)) {
        setErrorMsg('올바른 이메일 형식을 입력해주세요')
        setSaving(false)
        return
      }
    }
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phones: phones.map(p => p.trim()).filter(Boolean),
        role: role.trim() || null,
        company_id: companyId || null,
        notes: notes.trim() || null,
        tags,
      }
      if (contact) {
        await updateContact.mutateAsync({ id: contact.id, ...payload })
      } else {
        await createContact.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {contact ? '연락처 수정' : '새 연락처'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="홍길동" maxLength={50}
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            />
          </div>

          {/* 회사 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">소속 회사</label>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            >
              <option value="">선택 안 함 (개인)</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 직함 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">직함 / 역할</label>
            <input
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="개발팀장" maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hong@example.com" maxLength={100}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            />
          </div>

          {/* 전화번호 (복수) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">전화번호</label>
              <button
                type="button"
                onClick={addPhone}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <Plus size={11} /> 번호 추가
              </button>
            </div>
            <div className="space-y-2">
              {phones.map((phone, i) => (
                <div key={i} className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => updatePhone(i, e.target.value)}
                      placeholder="010-0000-0000" maxLength={30}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
                    />
                  </div>
                  {phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors px-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">태그</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                  {tag}
                  <button type="button" onClick={() => setTags(p => p.filter(t => t !== tag))} className="text-gray-400 hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="태그 입력 후 Enter" maxLength={30}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
              />
              <button type="button" onClick={addTag}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">메모</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="이 연락처에 대한 메모..." maxLength={2000}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 resize-none"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              취소
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className={cn('px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg transition-colors',
                saving || !name.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 dark:hover:bg-white')}>
              {saving ? '저장 중...' : (contact ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
