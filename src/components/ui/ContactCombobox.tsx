'use client'

import { useState, useRef } from 'react'
import { X, User } from 'lucide-react'
import type { Contact } from '@/types'

const MAX_ASSIGNEES = 5

interface Props {
  contacts: Contact[]
  contactIds: string[]
  assigneeNames: string[]
  onChange: (contactIds: string[], assigneeNames: string[]) => void
}

export default function ContactCombobox({ contacts, contactIds, assigneeNames, onChange }: Props) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const total = contactIds.length + assigneeNames.length
  const atMax = total >= MAX_ASSIGNEES

  const filtered = inputValue.trim()
    ? contacts.filter(c => {
        if (contactIds.includes(c.id)) return false
        const q = inputValue.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.company?.name?.toLowerCase().includes(q) ||
          c.role?.toLowerCase().includes(q)
        )
      })
    : contacts.filter(c => !contactIds.includes(c.id))

  function handleSelect(contact: Contact) {
    if (atMax) return
    onChange([...contactIds, contact.id], assigneeNames)
    setInputValue('')
    setIsOpen(false)
  }

  function handleRemoveContact(id: string) {
    onChange(contactIds.filter(cid => cid !== id), assigneeNames)
  }

  function handleRemoveName(name: string) {
    onChange(contactIds, assigneeNames.filter(n => n !== name))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault()
      const val = inputValue.trim()
      const exact = contacts.find(c => c.name === val && !contactIds.includes(c.id))
      if (exact) {
        handleSelect(exact)
      } else if (!atMax && !assigneeNames.includes(val)) {
        onChange(contactIds, [...assigneeNames, val])
        setInputValue('')
        setIsOpen(false)
      }
    }
    if (e.key === 'Backspace' && !inputValue) {
      if (assigneeNames.length > 0) {
        onChange(contactIds, assigneeNames.slice(0, -1))
      } else if (contactIds.length > 0) {
        onChange(contactIds.slice(0, -1), assigneeNames)
      }
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setIsOpen(false)
      const val = inputValue.trim()
      if (val && !atMax && !assigneeNames.includes(val)) {
        const exact = contacts.find(c => c.name === val && !contactIds.includes(c.id))
        if (exact) {
          onChange([...contactIds, exact.id], assigneeNames)
        } else {
          onChange(contactIds, [...assigneeNames, val])
        }
        setInputValue('')
      }
    }, 150)
  }

  const chipClass = 'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 shrink-0'

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-gray-200 dark:focus-within:ring-gray-600 min-h-[38px]">
        <User size={14} className="text-gray-400 shrink-0" />

        {contactIds.map(id => {
          const contact = contacts.find(c => c.id === id)
          if (!contact) return null
          return (
            <span key={id} className={chipClass}>
              {contact.name}
              <button type="button" onMouseDown={e => { e.preventDefault(); handleRemoveContact(id) }} className="hover:text-teal-900 dark:hover:text-teal-100">
                <X size={10} />
              </button>
            </span>
          )
        })}
        {assigneeNames.map(name => (
          <span key={name} className={chipClass}>
            {name}
            <button type="button" onMouseDown={e => { e.preventDefault(); handleRemoveName(name) }} className="hover:text-teal-900 dark:hover:text-teal-100">
              <X size={10} />
            </button>
          </span>
        ))}

        {!atMax && (
          <input
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setIsOpen(true) }}
            onFocus={() => setIsOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={total === 0 ? '담당자 검색 또는 직접 입력...' : '추가...'}
            className="flex-1 min-w-[100px] text-sm text-gray-700 dark:text-gray-200 bg-transparent focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        )}
        {atMax && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">최대 {MAX_ASSIGNEES}명</span>
        )}
      </div>

      {isOpen && filtered.length > 0 && !atMax && (
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
