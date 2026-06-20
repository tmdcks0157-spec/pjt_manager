'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Users, Building2, Plus, Search, Phone, Mail, ChevronRight, ListTodo, Pencil, Globe, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useContacts, useCompanies } from '@/hooks/useCRM'
import { useAuthStore } from '@/stores/auth-store'
import ContactForm from '@/components/crm/ContactForm'
import CompanyForm from '@/components/crm/CompanyForm'
import type { Contact, Company } from '@/types'

function ContactCard({ contact, taskCount = 0 }: { contact: Contact; taskCount?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group">
      <Link href={`/crm/contacts/${contact.id}`} className="block mb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {contact.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {[contact.company?.name, contact.role].filter(Boolean).join(' · ') || '개인'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {taskCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium">
                <ListTodo size={9} /> {taskCount}
              </span>
            )}
            <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
          </div>
        </div>
      </Link>

      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {contact.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 mt-2">
        {contact.email && (
          <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
            <Mail size={11} className="shrink-0" /> {contact.email}
          </a>
        )}
        {contact.phones?.map((phone, i) => (
          <a key={i} href={`tel:${phone}`} onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
            <Phone size={11} className="shrink-0" /> {phone}
          </a>
        ))}
      </div>
    </div>
  )
}

function CompanyCard({ company, contactCount, onClick }: { company: Company; contactCount: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{company.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{company.industry || '업종 미입력'}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">{contactCount}명</span>
          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
        </div>
      </div>
      {company.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {company.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CRMPage() {
  const [tab, setTab] = useState<'contacts' | 'companies'>('contacts')
  const [search, setSearch] = useState('')
  const [showContactForm, setShowContactForm] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)

  const user = useAuthStore((s) => s.user)
  const { data: contacts = [], isLoading: loadingContacts } = useContacts()
  const { data: companies = [], isLoading: loadingCompanies } = useCompanies()

  // 연락처별 활성 태스크 수 (완료/보관/삭제 제외)
  const { data: taskCountMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['contact-task-counts'],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: tasks }, { data: doneCols }] = await Promise.all([
        supabase.from('tasks').select('contact_id, status').not('contact_id', 'is', null).eq('archived', false).is('deleted_at', null),
        supabase.from('columns').select('id').eq('name', '완료'),
      ])
      const doneColIds = new Set((doneCols ?? []).map(c => c.id))
      const counts: Record<string, number> = {}
      for (const t of (tasks ?? [])) {
        if (!t.contact_id || doneColIds.has(t.status)) continue
        counts[t.contact_id] = (counts[t.contact_id] ?? 0) + 1
      }
      return counts
    },
  })

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.name.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q)
    )
  }, [contacts, search])

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q)
    )
  }, [companies, search])

  const contactCountByCompany = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of contacts) {
      if (c.company_id) map[c.company_id] = (map[c.company_id] ?? 0) + 1
    }
    return map
  }, [contacts])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">연락처</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompanyForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Building2 size={13} /> 회사 추가
          </button>
          <button
            onClick={() => setShowContactForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-white transition-colors"
          >
            <Plus size={13} /> 연락처 추가
          </button>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setTab('contacts')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              tab === 'contacts'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Users size={13} /> 사람 {contacts.length > 0 && <span className="text-gray-400">{contacts.length}</span>}
          </button>
          <button
            onClick={() => setTab('companies')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              tab === 'companies'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Building2 size={13} /> 회사 {companies.length > 0 && <span className="text-gray-400">{companies.length}</span>}
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 회사, 이메일 검색..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
          />
        </div>
      </div>

      {/* 목록 */}
      {tab === 'contacts' && (
        loadingContacts ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? '검색 결과가 없습니다' : '등록된 연락처가 없습니다'}</p>
            {!search && (
              <button onClick={() => setShowContactForm(true)} className="mt-3 text-xs text-blue-500 hover:underline">
                첫 연락처 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredContacts.map(c => <ContactCard key={c.id} contact={c} taskCount={taskCountMap[c.id] ?? 0} />)}
          </div>
        )
      )}

      {tab === 'companies' && (
        loadingCompanies ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Building2 size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? '검색 결과가 없습니다' : '등록된 회사가 없습니다'}</p>
            {!search && (
              <button onClick={() => setShowCompanyForm(true)} className="mt-3 text-xs text-blue-500 hover:underline">
                첫 회사 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCompanies.map(c => (
              <CompanyCard key={c.id} company={c} contactCount={contactCountByCompany[c.id] ?? 0} onClick={() => setSelectedCompany(c)} />
            ))}
          </div>
        )
      )}

      {showContactForm && (
        <ContactForm
          companies={companies}
          onClose={() => setShowContactForm(false)}
        />
      )}
      {(showCompanyForm || editingCompany) && (
        <CompanyForm
          company={editingCompany ?? undefined}
          onClose={() => { setShowCompanyForm(false); setEditingCompany(null) }}
        />
      )}

      {/* 회사 상세 모달 */}
      {selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedCompany.name}</h2>
                {selectedCompany.industry && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedCompany.industry}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => { setEditingCompany(selectedCompany); setSelectedCompany(null) }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Pencil size={11} /> 수정
                </button>
                <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 회사 정보 */}
            {(selectedCompany.phone || selectedCompany.website || selectedCompany.notes || selectedCompany.tags.length > 0) && (
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 space-y-2">
                {selectedCompany.phone && (
                  <a href={`tel:${selectedCompany.phone}`} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <Phone size={12} className="shrink-0" /> {selectedCompany.phone}
                  </a>
                )}
                {selectedCompany.website && (
                  <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <Globe size={12} className="shrink-0" /> {selectedCompany.website}
                  </a>
                )}
                {selectedCompany.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{selectedCompany.notes}</p>
                )}
                {selectedCompany.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedCompany.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 소속 연락처 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                소속 연락처 ({contacts.filter(c => c.company_id === selectedCompany.id).length}명)
              </h3>
              {contacts.filter(c => c.company_id === selectedCompany.id).length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">소속 연락처가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {contacts.filter(c => c.company_id === selectedCompany.id).map(contact => (
                    <Link
                      key={contact.id}
                      href={`/crm/contacts/${contact.id}`}
                      onClick={() => setSelectedCompany(null)}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {contact.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {contact.role && <span className="text-xs text-gray-500 dark:text-gray-400">{contact.role}</span>}
                          {contact.email && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{contact.email}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 shrink-0 ml-2" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
