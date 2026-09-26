import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe, Grid3x3, Users, Clock, ArrowRight, X } from 'lucide-react'
import Logo from '../components/Logo'
import { usePeer } from './usePeer'
import { useStored, startTone, parseTarget } from './utils'
import InternetTab from './InternetTab'
import Dialer from './Dialer'
import Contacts from './Contacts'
import Recents from './Recents'
import IncomingCall from './IncomingCall'
import InCall from './InCall'

const TABS = [
  { id: 'app', label: 'שיחת אינטרנט', icon: Globe },
  { id: 'phone', label: 'חייגן', icon: Grid3x3 },
  { id: 'contacts', label: 'אנשי קשר', icon: Users },
  { id: 'recent', label: 'אחרונות', icon: Clock },
]

const STATUS = {
  ready: { label: 'מחובר', dot: 'bg-emerald-500' },
  connecting: { label: 'מתחבר…', dot: 'bg-amber-400 animate-pulse' },
  offline: { label: 'לא מחובר', dot: 'bg-rose-500' },
}

export default function CallApp() {
  const inviteTarget = useMemo(() => {
    const to = new URLSearchParams(location.search).get('to')
    return to ? parseTarget(to) : ''
  }, [])

  const [tab, setTab] = useState('app')
  const [name, setName] = useStored('dayspace-call-name', '')
  const [contacts, setContacts] = useStored('dayspace-call-contacts', [])
  const [recents, setRecents] = useStored('dayspace-call-recents', [])

  const addRecent = useCallback((entry) => {
    setRecents((r) => [{ id: `${entry.at}-${Math.random().toString(36).slice(2, 6)}`, ...entry }, ...r].slice(0, 60))
  }, [setRecents])

  const peer = usePeer({ myName: name, onLog: addRecent })
  const { incoming, call, error, setError, startCall } = peer

  const nameFor = useCallback((kind, value, fallback) => {
    const c = contacts.find((x) => x.kind === kind && x.value === value)
    return c?.name || fallback || value
  }, [contacts])

  const callApp = useCallback((target, video, displayName) => {
    const id = parseTarget(target)
    startCall(id, { video, name: displayName || nameFor('app', id) })
  }, [startCall, nameFor])

  const saveContact = useCallback((contact) => {
    setContacts((list) => {
      const rest = list.filter((c) => !(c.kind === contact.kind && c.value === contact.value))
      return [...rest, { id: Date.now().toString(36), ...contact }].sort((a, b) => a.name.localeCompare(b.name, 'he'))
    })
  }, [setContacts])

  // Ring while someone is calling us, ringback while we wait for them.
  useEffect(() => (incoming ? startTone('ring') : undefined), [incoming])
  useEffect(() => (call?.phase === 'ringing' ? startTone('back') : undefined), [call?.phase])

  // Show who's calling in the tab title, so it's visible from other tabs.
  useEffect(() => {
    const base = document.title
    if (!incoming) return
    document.title = `📞 ${nameFor('app', incoming.from, incoming.name)} מתקשר/ת…`
    return () => { document.title = base }
  }, [incoming, nameFor])

  const status = STATUS[peer.status]

  return (
    <div className="min-h-dvh grid-bg">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-[color:var(--color-line)]">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" aria-label="חזרה לדף הבית" className="inline-flex items-center gap-2 shrink-0">
            <ArrowRight size={18} className="text-[color:var(--color-muted)]" />
            <Logo size={28} />
          </a>
          <div className="inline-flex items-center gap-2 bg-white border border-[color:var(--color-line)] rounded-full px-3 py-1.5 text-sm font-medium text-[color:var(--color-ink-soft)]" role="status">
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            {status.label}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-6 pb-32">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          התקשרו לכל אחד <span className="brand-text">מהדפדפן.</span>
        </h1>
        <p className="mt-2 text-[color:var(--color-ink-soft)]">
          שיחות קוליות ווידאו בחינם דרך האינטרנט, או חיוג רגיל למספר טלפון.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-4 py-3 text-sm" role="alert">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} aria-label="סגירה" className="shrink-0 opacity-70 hover:opacity-100"><X size={16} /></button>
          </div>
        )}

        <div className="mt-6">
          {tab === 'app' && (
            <InternetTab
              myId={peer.myId}
              status={peer.status}
              name={name}
              setName={setName}
              inviteTarget={inviteTarget}
              inviteName={inviteTarget ? nameFor('app', inviteTarget, '') : ''}
              onCall={callApp}
              onSave={saveContact}
            />
          )}
          {tab === 'phone' && (
            <Dialer
              onDial={(value) => addRecent({ kind: 'phone', target: value, name: nameFor('phone', value, ''), dir: 'out', at: Date.now(), duration: 0 })}
              onSave={saveContact}
            />
          )}
          {tab === 'contacts' && (
            <Contacts
              contacts={contacts}
              onSave={saveContact}
              onDelete={(id) => setContacts((list) => list.filter((c) => c.id !== id))}
              onCallApp={callApp}
              onDial={(c) => addRecent({ kind: 'phone', target: c.value, name: c.name, dir: 'out', at: Date.now(), duration: 0 })}
            />
          )}
          {tab === 'recent' && (
            <Recents
              recents={recents}
              nameFor={nameFor}
              onClear={() => setRecents([])}
              onCallApp={callApp}
              onDial={(r) => addRecent({ kind: 'phone', target: r.target, name: r.name, dir: 'out', at: Date.now(), duration: 0 })}
            />
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-[color:var(--color-line)] pb-[env(safe-area-inset-bottom)]" aria-label="מסכים">
        <div className="max-w-xl mx-auto grid grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition ${active ? 'text-[color:var(--color-brand)]' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]'}`}
              >
                <span className={`grid place-items-center w-12 h-7 rounded-full transition ${active ? 'bg-[color:var(--color-brand)]/10' : ''}`}>
                  <Icon size={19} />
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      {incoming && !call && (
        <IncomingCall
          incoming={incoming}
          displayName={nameFor('app', incoming.from, incoming.name)}
          onAnswer={peer.answer}
          onDecline={peer.decline}
        />
      )}
      {call && (
        <InCall
          call={call}
          displayName={nameFor('app', call.remoteId, call.name)}
          localStream={peer.localStream}
          remoteStream={peer.remoteStream}
          onHangup={peer.hangup}
        />
      )}
    </div>
  )
}
