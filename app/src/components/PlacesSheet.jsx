import { useEffect, useState } from 'react'
import { Button, EmptyState, Field, Sheet, TextInput } from './ui'
import { IconPin, IconPlus, IconTrash } from './Icons'
import { distance, formatDistance } from '../lib/geo'
import { reverseGeocode } from '../lib/geocode'

const PLACE_EMOJIS = ['🏠', '🏫', '💼', '🏋️', '🛒', '🏥', '⚽', '🎭', '☕', '🌳', '🕍', '📍']
const RADII = [100, 150, 250, 500, 1000]

export default function PlacesSheet({
  open,
  onClose,
  places,
  members,
  selfLocation,
  draft,
  onClearDraft,
  onAdd,
  onRemove,
  onFocus,
}) {
  const [editing, setEditing] = useState(null)

  // A long-press on the map hands us a draft location — jump straight into the editor.
  useEffect(() => {
    if (draft) setEditing({ lat: draft.lat, lng: draft.lng, name: draft.name || '', emoji: '📍', radius: 150 })
  }, [draft])

  function startFromSelf() {
    if (!selfLocation) return
    setEditing({ lat: selfLocation.lat, lng: selfLocation.lng, name: '', emoji: '🏠', radius: 150 })
  }

  function close() {
    setEditing(null)
    onClearDraft?.()
    onClose()
  }

  if (editing) {
    return (
      <PlaceEditor
        open={open}
        draft={editing}
        onCancel={() => {
          setEditing(null)
          onClearDraft?.()
        }}
        onSave={async (place) => {
          await onAdd(place)
          setEditing(null)
          onClearDraft?.()
        }}
      />
    )
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="מקומות"
      subtitle="קבלו התראה כשמישהו מגיע או יוצא"
      height={0.66}
      footer={
        <Button onClick={startFromSelf} disabled={!selfLocation} className="mb-1 w-full">
          <span className="flex items-center justify-center gap-2">
            <IconPlus size={18} /> הוספת מקום מהמיקום הנוכחי
          </span>
        </Button>
      }
    >
      {places.length === 0 ? (
        <EmptyState
          emoji="🏠"
          title="אין עדיין מקומות"
          body="הוסיפו את הבית, בית הספר או העבודה — ותקבלו התראה כשמישהו מגיע לשם. אפשר גם ללחוץ לחיצה ארוכה על המפה."
        />
      ) : (
        <ul className="space-y-2 pb-2">
          {places.map((place) => {
            const inside = members.filter(
              (m) => (distance(m, place) ?? Infinity) <= (place.radius || 150),
            )
            const away = selfLocation ? distance(selfLocation, place) : null
            return (
              <li
                key={place.id}
                className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 transition active:bg-white/8"
              >
                <button
                  type="button"
                  onClick={() => {
                    onFocus(place)
                    close()
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-start"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/8 text-xl">
                    {place.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15.5px] font-bold text-white">{place.name}</p>
                    <p className="truncate text-[12.5px] text-white/45">
                      {inside.length
                        ? `${inside.map((m) => m.name).join(', ')} כאן עכשיו`
                        : place.address || `רדיוס ${place.radius} מ׳`}
                    </p>
                    {away != null && (
                      <p className="mt-0.5 text-[11.5px] font-semibold text-white/30">
                        {formatDistance(away)} ממך
                      </p>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(place.id)}
                  aria-label={`מחיקת ${place.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-white/45 transition active:scale-90 active:text-rose-400"
                >
                  <IconTrash size={17} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

function PlaceEditor({ open, draft, onCancel, onSave }) {
  const [name, setName] = useState(draft.name || '')
  const [emoji, setEmoji] = useState(draft.emoji || '📍')
  const [radius, setRadius] = useState(draft.radius || 150)
  const [address, setAddress] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    reverseGeocode(draft.lat, draft.lng).then((result) => {
      if (!alive) return
      setAddress(result?.short || null)
      setName((current) => current || result?.short?.split(',')[0] || '')
    })
    return () => {
      alive = false
    }
  }, [draft.lat, draft.lng])

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="מקום חדש"
      subtitle={address || `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}
      height={0.7}
      footer={
        <div className="mb-1 flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            ביטול
          </Button>
          <Button
            className="flex-[2]"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true)
              await onSave({ ...draft, name: name.trim(), emoji, radius, address })
              setBusy(false)
            }}
          >
            שמירה
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label="שם המקום">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="בית, בית ספר, עבודה…"
            maxLength={24}
            autoFocus
          />
        </Field>

        <Field label="אייקון">
          <div className="grid grid-cols-6 gap-2">
            {PLACE_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                className={`grid h-12 place-items-center rounded-2xl border text-xl transition active:scale-90 ${
                  emoji === option ? 'border-brand-400 bg-brand-500/20' : 'border-white/10 bg-white/5'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </Field>

        <Field label="רדיוס ההתראה" hint="נקבל התראה כשמישהו נכנס או יוצא מהאזור הזה">
          <div className="flex gap-2">
            {RADII.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRadius(option)}
                className={`flex-1 rounded-2xl border py-2.5 text-[13px] font-bold transition active:scale-95 ${
                  radius === option
                    ? 'border-brand-400 bg-brand-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-white/60'
                }`}
              >
                {option >= 1000 ? `${option / 1000} ק״מ` : `${option} מ׳`}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-3 text-[12.5px] text-white/50">
          <IconPin size={18} />
          <span>אפשר גם ללחוץ לחיצה ארוכה על המפה כדי להוסיף מקום בכל נקודה.</span>
        </div>
      </div>
    </Sheet>
  )
}
