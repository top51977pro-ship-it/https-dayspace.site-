import { useEffect, useRef, useState } from 'react'
import { IconClose, IconSearch } from './Icons'
import { placeEmoji, searchPlaces } from '../lib/geocode'
import { distance, formatDistance } from '../lib/geo'
import { Avatar } from './ui'
import { tap } from '../lib/device'

export default function SearchBar({ members, selfLocation, onPickPlace, onPickMember }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const text = query.trim()
    if (text.length < 2) {
      setResults([])
      setStatus('idle')
      return undefined
    }

    setStatus('loading')
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const found = await searchPlaces(text, selfLocation, controller.signal)
        setResults(found)
        setStatus('done')
      } catch (err) {
        if (err?.name !== 'AbortError') setStatus('error')
      }
    }, 420)

    return () => clearTimeout(timer)
  }, [query, open, selfLocation])

  const matchedMembers = query.trim()
    ? members.filter((m) => m.name?.includes(query.trim()))
    : []

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
    setStatus('idle')
    abortRef.current?.abort()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          tap()
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 60)
        }}
        className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start shadow-float transition active:scale-[.98]"
      >
        <IconSearch size={20} />
        <span className="text-[15px] font-semibold text-white/45">חיפוש מקום או בן משפחה</span>
      </button>
    )
  }

  return (
    <div className="glass-strong animate-fade-in overflow-hidden rounded-3xl shadow-float">
      <div className="flex items-center gap-2 px-4 py-3">
        <IconSearch size={20} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="לאן נוסעים?"
          className="min-w-0 flex-1 bg-transparent text-[15.5px] font-semibold text-white outline-none placeholder:text-white/35"
        />
        <button
          type="button"
          onClick={close}
          aria-label="סגירת חיפוש"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/8 text-white/70 active:scale-90"
        >
          <IconClose size={16} />
        </button>
      </div>

      {(query.trim().length >= 2 || matchedMembers.length > 0) && (
        <div className="scroll-area max-h-[52dvh] border-t border-white/8">
          {matchedMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                tap()
                onPickMember(member)
                close()
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-start transition active:bg-white/6"
            >
              <Avatar member={member} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-bold text-white">{member.name}</p>
                <p className="text-[12px] text-white/45">בן משפחה</p>
              </div>
            </button>
          ))}

          {status === 'loading' && (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-11 rounded-xl" />
              ))}
            </div>
          )}

          {status === 'error' && (
            <p className="px-4 py-6 text-center text-[13px] text-white/45">
              החיפוש נכשל — בדקו חיבור לאינטרנט
            </p>
          )}

          {status === 'done' && !results.length && !matchedMembers.length && (
            <p className="px-4 py-6 text-center text-[13px] text-white/45">לא נמצאו תוצאות</p>
          )}

          {results.map((result) => {
            const away = selfLocation ? distance(selfLocation, result) : null
            return (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  tap()
                  onPickPlace(result)
                  close()
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-start transition active:bg-white/6"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 text-lg">
                  {placeEmoji(result)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold text-white">{result.name}</p>
                  <p className="truncate text-[12px] text-white/45">{result.address}</p>
                </div>
                {away != null && (
                  <span className="shrink-0 text-[12px] font-semibold text-white/40">
                    {formatDistance(away)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
