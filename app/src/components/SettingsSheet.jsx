import { useEffect, useState } from 'react'
import { Avatar, Button, Field, Sheet, TextInput, Toggle } from './ui'
import { IconBell, IconGhost, IconHistory, IconLocate } from './Icons'
import { EMOJIS, PALETTE } from '../lib/id'
import { MAP_LAYERS } from './MapView'
import { getProvider } from '../sync'
import { IconCheck } from './Icons'

export default function SettingsSheet({
  open,
  onClose,
  profile,
  circle,
  settings,
  mode,
  connection,
  onSaveProfile,
  onSetSetting,
  onLeave,
}) {
  const [name, setName] = useState(profile?.name || '')
  const [emoji, setEmoji] = useState(profile?.emoji || EMOJIS[0])
  const [color, setColor] = useState(profile?.color || PALETTE[0])
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [broker, setBroker] = useState(null)

  useEffect(() => {
    if (!open || !circle?.id) return
    getProvider()
      .diagnostics?.(circle.id)
      .then((info) => setBroker(info?.broker || null))
      .catch(() => {})
  }, [open, circle?.id, connection])

  const dirty =
    name.trim() !== profile?.name || emoji !== profile?.emoji || color !== profile?.color

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="הגדרות"
      subtitle={circle?.name}
      height={0.85}
      footer={
        dirty ? (
          <Button
            className="mb-1 w-full"
            onClick={() => {
              onSaveProfile({ name: name.trim() || profile?.name, emoji, color })
              onClose()
            }}
          >
            שמירת שינויים
          </Button>
        ) : null
      }
    >
      <div className="space-y-7 pb-4">
        {/* profile ------------------------------------------------------- */}
        <section>
          <SectionTitle>הפרופיל שלי</SectionTitle>
          <div className="rounded-3xl bg-white/5 p-4">
            <div className="flex items-center gap-4">
              <Avatar member={{ name, emoji, color }} size={60} />
              <div className="min-w-0 flex-1">
                <Field label="שם">
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={18}
                  />
                </Field>
              </div>
            </div>

            <div className="no-scrollbar mt-4 -mx-1 flex gap-2 overflow-x-auto px-1">
              {EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-xl transition active:scale-90 ${
                    emoji === option
                      ? 'border-brand-400 bg-brand-500/20'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-8 gap-2">
              {PALETTE.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`צבע ${option}`}
                  className="grid aspect-square w-full place-items-center rounded-full transition active:scale-90"
                  style={{
                    background: option,
                    boxShadow: color === option ? '0 0 0 3px rgb(255 255 255 / .85)' : 'none',
                  }}
                >
                  {color === option && <IconCheck size={16} />}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* privacy ------------------------------------------------------- */}
        <section>
          <SectionTitle>פרטיות ושיתוף</SectionTitle>
          <div className="rounded-3xl bg-white/5 px-3 py-1">
            <Toggle
              icon={<IconLocate size={19} />}
              label="שיתוף המיקום שלי"
              description="כשכבוי — המשפחה לא רואה איפה אתם"
              checked={settings.sharing}
              onChange={(v) => onSetSetting('sharing', v)}
            />
            <Divider />
            <Toggle
              icon={<IconGhost size={19} />}
              label="מצב רפאים"
              description="הסתרה זמנית בלי לכבות את השיתוף לגמרי"
              checked={settings.ghost}
              onChange={(v) => onSetSetting('ghost', v)}
            />
            <Divider />
            <Toggle
              icon={<IconBell size={19} />}
              label="התראות הגעה ויציאה"
              description="עדכון כשמישהו מגיע או יוצא ממקום ששמרתם"
              checked={settings.alerts}
              onChange={(v) => onSetSetting('alerts', v)}
            />
            <Divider />
            <Toggle
              icon={<IconHistory size={19} />}
              label="שמירת מסלול תנועה"
              description="נשמר רק במכשיר שלכם, ומוצג בלחיצה על בן משפחה"
              checked={settings.trails}
              onChange={(v) => onSetSetting('trails', v)}
            />
          </div>
        </section>

        {/* map ----------------------------------------------------------- */}
        <section>
          <SectionTitle>סגנון המפה</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(MAP_LAYERS).map(([id, config]) => (
              <button
                key={id}
                type="button"
                onClick={() => onSetSetting('mapStyle', id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition active:scale-95 ${
                  settings.mapStyle === id
                    ? 'border-brand-400 bg-brand-500/20'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <span className="text-xl">{config.emoji}</span>
                <span className="text-[11.5px] font-bold text-white/75">{config.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* about --------------------------------------------------------- */}
        <section>
          <SectionTitle>על האפליקציה</SectionTitle>
          <div className="space-y-2 rounded-3xl bg-white/5 p-4 text-[13px] leading-relaxed text-white/50">
            <Row label="גרסה" value="1.0.0" />
            <Row label="קוד המשפחה" value={circle?.code || '—'} mono />
            <Row
              label="מצב סנכרון"
              value={
                mode === 'firebase'
                  ? 'ענן פרטי (Firebase)'
                  : mode === 'mqtt'
                    ? 'ערוץ מוצפן משותף'
                    : 'הדגמה מקומית'
              }
            />
            {mode === 'mqtt' && (
              <>
                <Row
                  label="חיבור"
                  value={
                    connection === 'online'
                      ? '🟢 מחובר'
                      : connection === 'connecting'
                        ? '🟡 מתחבר…'
                        : '🔴 מנותק'
                  }
                />
                {broker && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0">שרת</span>
                    <span className="min-w-0 truncate text-end font-mono text-[11px] text-white/60" dir="ltr">
                      {broker}
                    </span>
                  </div>
                )}
              </>
            )}
            {mode === 'demo' && (
              <p className="pt-1 text-[12px] text-white/40">
                במצב הדגמה הנתונים נשמרים במכשיר בלבד, ובני המשפחה על המפה הם דמויות לדוגמה.
              </p>
            )}
          </div>
        </section>

        {/* danger -------------------------------------------------------- */}
        <section>
          {confirmLeave ? (
            <div className="space-y-3 rounded-3xl border border-rose-400/30 bg-rose-400/10 p-4">
              <p className="text-[14px] font-bold text-white">לצאת מהמשפחה?</p>
              <p className="text-[12.5px] leading-relaxed text-white/55">
                המיקום שלכם יוסר מהמפה של כולם, וההיסטוריה במכשיר תימחק.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmLeave(false)}>
                  ביטול
                </Button>
                <Button variant="solidDanger" className="flex-1" onClick={onLeave}>
                  יציאה
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmLeave(true)}>
              יציאה מהמשפחה
            </Button>
          )}
        </section>
      </div>
    </Sheet>
  )
}

const SectionTitle = ({ children }) => (
  <h3 className="mb-2 px-1 text-[12px] font-black tracking-wide text-white/35">{children}</h3>
)

const Divider = () => <div className="mx-1 h-px bg-white/7" />

const Row = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-3">
    <span>{label}</span>
    <span className={`font-semibold text-white/75 ${mono ? 'font-mono tracking-widest' : ''}`}>
      {value}
    </span>
  </div>
)
