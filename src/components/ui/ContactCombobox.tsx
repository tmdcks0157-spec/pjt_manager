'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, User } from 'lucide-react'
import type { Contact } from '@/types'

interface Props {
  contacts: Contact[]
  contactId: string
  assigneeName: string
  onChange: (contactId: string, assigneeName: string) => void
}

export default function ContactCombobox({ contacts, contactId, assigneeName, onChange }: Props) {
  const initialDisplay = contactId
    ? (contacts.find(c => c.id === contactId)?.name ?? '')
    : assigneeName

  const [inputValue, setInputValue] = useState(initialDisplay)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // contacts 로드 후 contactId에 해당하는 이름으로 동기화
  useEffect(() => {
    if (contactId) {
      const found = contacts.find(c => c.id === contactId)
      if (found) setInputValue(found.name)
    }
  }, [contacts, contactId])

  const filtered = inputValue.trim()
    ? contacts.filter(c => {
        const q = inputValue.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.company?.name?.toLowerCase().includes(q) ||
          c.role?.toLowerCase().includes(q)
        )
      })
    : contacts

  function handleSelect(contact: Contact) {
    setInputValue(contact.name)
    setIsOpen(false)
    onChange(contact.id, '')
  }

  function handleClear() {
    setInputValue('')
    setIsOpen(false)
    onChange('', '')
  }

  const commitFreeText = useCallback(() => {
    const val = inputValue.trim()
    if (!val) {
      onChange('', '')
      return
    }
    const exact = contacts.find(c => c.name === val)
    if (exact) {
      onChange(exact.id, '')
    } else {
      onChange('', val)
    }
  }, [inputValue, contacts, onChange])

  function handleBlur() {
    // 드롭다운 항목 클릭(onMouseDown)이 blur보다 늦게 처리되면 안 되므로
    // 짧은 지연 후 닫기
    setTimeout(() => {
      setIsOpen(false)
      commitFreeText()
    }, 150)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-gray-200 dark:focus-within:ring-gray-600">
        <User size={14} className="text-gray-400 shrink-0" />
        <input
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          placeholder="담당자 검색 또는 직접 입력..."
          className="flex-1 text-sm text-gray-700 dark:text-gray-200 bg-transparent focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        {inputValue && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleClear() }}
            className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
          {filtered.slice(0, 8).map(contact => (
            <li
              key={contact.id}
              onMouseDown={() => handleSelect(contact)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl"
            >
              <User size={12} className="text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{contact.name}</span>
              {(contact.company?.name || contact.role) && (
                <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {[contact.company?.name, contact.role].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
