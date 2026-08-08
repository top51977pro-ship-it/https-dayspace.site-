import { useEffect, useState } from 'react'
import { Avatar, Button, Field, TextInput } from './ui'
import { EMOJIS, PALETTE, normalizeCode } from '../lib/id'
import { useApp } from '../state/AppContext'
import { onInviteCode } from '../lib/deeplink'
import { IconCheck } from './Icons'

const STEPS = { welcome: 0, profile: 1, mode: 2, join: 3 }

export default function Onboarding() {
  const { createFamily, joinFamily, mode, backendSwitched, pushToast } = useApp()
  const [step, setStep] = useState(STEPS.welcome)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState(PALETTE[0])
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const preview = { name: name || 'אני', emoji, color }

  // Someone tapped an invite link — carry the code straight into the flow.
  useEffect(
    () =>
      onInviteCode((incoming) => {
        setCode(incoming)
        setStep((current) => (current === STEPS.welcome ? STEPS.profile : current))
      }),
    [],
  )

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      await createFamily(familyName || `המשפחה של ${name}`, { name: name.trim(), emoji, color })
    } catch (err) {
      setError(err?.message || 'משהו השתבש, נסו שוב')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    setBusy(true)
    setError(null)
    try {
      await joinFamily(code, { name: name.trim(), emoji, color })
      pushToast('הצטרפת למשפחה! 🎉', 'success')
    } catch (err) {
      setError(
        err?.code === 'code-not-found'
          ? 'לא מצאנו משפחה עם הקוד הזה'
          : err?.code === 'code-too-short'
            ? 'קוד ההזמנה קצר מדי'
            : 'ההצטרפות נכשלה, בדקו חיבור לאינטרנט',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink-950">
      <Backdrop />

      <div className="scroll-area pad-top relative z-10 flex flex-1 flex-col px-6 pb-8">
        {backendSwitched && step === STEPS.welcome && (
          <div className="mt-2 rounded-2xl border border-mint-400/30 bg-mint-400/10 p-4 text-[13px] leading-relaxed text-mint-400">
            <p className="font-bold">☁️ עברתם למצב ענן — שיתוף מיקום אמיתי</p>
            <p className="mt-1 text-white/60">
              המשפחה הקודמת הייתה משפחת הדגמה ולכן נמחקה. צרו משפחה חדשה ושלחו את קוד
              ההזמנה לבני הבית — מעכשיו רואים אותם באמת.
            </p>
          </div>
        )}

        {step === STEPS.welcome && (
          <Welcome onNext={() => setStep(STEPS.profile)} demo={mode === 'demo'} />
        )}

        {step === STEPS.profile && (
          <div className="animate-fade-in flex flex-1 flex-col justify-center gap-7 py-8">
            <header className="text-center">
              <h1 className="text-[28px] font-black text-white">איך נזהה אתכם?</h1>
              <p className="mt-2 text-[14.5px] text-white/50">
                השם והאייקון שיופיעו למשפחה על המפה
              </p>
            </header>

            <div className="flex justify-center">
              <div className="relative">
                <Avatar member={preview} size={96} />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-900 px-3 py-1 text-[12px] font-bold text-white shadow-float">
                  {preview.name}
                </span>
              </div>
            </div>

            <div className="space-y-5">
              <Field label="השם שלכם">
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: אמא, דני, נועה"
                  maxLength={18}
                  autoFocus
                />
              </Field>

              <Field label="אייקון">
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {EMOJIS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setEmoji(option)}
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl transition active:scale-90 ${
                        emoji === option
                          ? 'border-brand-400 bg-brand-500/20'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="צבע">
                <div className="grid grid-cols-8 gap-2.5">
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
                      {color === option && <IconCheck size={18} />}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Button
              onClick={() => setStep(code ? STEPS.join : STEPS.mode)}
              disabled={name.trim().length < 2}
            >
              {code ? 'ממשיכים להצטרפות' : 'ממשיכים'}
            </Button>
          </div>
        )}

        {step === STEPS.mode && (
          <div className="animate-fade-in flex flex-1 flex-col justify-center gap-6 py-8">
            <header className="text-center">
              <h1 className="text-[28px] font-black text-white">מתחילים משפחה?</h1>
              <p className="mt-2 text-[14.5px] text-white/50">פתחו קבוצה חדשה או הצטרפו לקיימת</p>
            </header>

            <div className="space-y-4">
              <div className="glass rounded-3xl p-5">
                <h2 className="text-[17px] font-bold text-white">🏡 פתיחת משפחה חדשה</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                  תקבלו קוד הזמנה שתשלחו לכל מי שתרצו לצרף.
                </p>
                <div className="mt-4 space-y-3">
                  <TextInput
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="שם המשפחה (לא חובה)"
                    maxLength={24}
                  />
                  <Button onClick={handleCreate} disabled={busy} className="w-full">
                    {busy ? 'רגע…' : 'יוצרים משפחה'}
                  </Button>
                </div>
              </div>

              <div className="glass rounded-3xl p-5">
                <h2 className="text-[17px] font-bold text-white">🔑 יש לי קוד הזמנה</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                  מישהו כבר שלח לכם קוד בן 6 תווים.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => setStep(STEPS.join)}
                  className="mt-4 w-full"
                >
                  הצטרפות עם קוד
                </Button>
              </div>
            </div>

            {error && <p className="text-center text-[13px] font-semibold text-rose-400">{error}</p>}

            <button
              type="button"
              onClick={() => setStep(STEPS.profile)}
              className="text-[13.5px] font-semibold text-white/40"
            >
              חזרה
            </button>
          </div>
        )}

        {step === STEPS.join && (
          <div className="animate-fade-in flex flex-1 flex-col justify-center gap-6 py-8">
            <header className="text-center">
              <h1 className="text-[28px] font-black text-white">קוד הזמנה</h1>
              <p className="mt-2 text-[14.5px] text-white/50">הקלידו את הקוד שקיבלתם</p>
            </header>

            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="A1B2C3"
              inputMode="text"
              autoCapitalize="characters"
              autoFocus
              dir="ltr"
              className="w-full rounded-3xl border border-white/12 bg-white/6 px-4 py-5 text-center font-mono text-[34px] font-black tracking-[0.3em] text-white outline-none transition placeholder:text-white/15 focus:border-brand-400/70"
            />

            {error && <p className="text-center text-[13px] font-semibold text-rose-400">{error}</p>}

            <Button onClick={handleJoin} disabled={busy || code.length < 4}>
              {busy ? 'מצטרפים…' : 'הצטרפות'}
            </Button>

            <button
              type="button"
              onClick={() => setStep(STEPS.mode)}
              className="text-[13.5px] font-semibold text-white/40"
            >
              חזרה
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Welcome({ onNext, demo }) {
  const features = [
    { emoji: '🗺️', title: 'מפה חיה', body: 'כל המשפחה על מפה אחת, בזמן אמת' },
    { emoji: '🏠', title: 'מקומות חכמים', body: 'התראה כשמישהו מגיע הביתה או לבית הספר' },
    { emoji: '🔋', title: 'סוללה ומרחק', body: 'רואים מי רחוק, ולמי עומדת להיגמר הסוללה' },
    { emoji: '🆘', title: 'כפתור מצוקה', body: 'שליחת מיקום דחוף לכל המשפחה בלחיצה' },
  ]

  return (
    <div className="animate-fade-in flex flex-1 flex-col justify-center gap-8 py-10">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-brand-400 to-brand-600 text-4xl shadow-float">
          🧭
        </div>
        <h1 className="mt-5 text-[32px] leading-tight font-black text-white">
          המשפחה שלכם
          <br />
          על מפה אחת
        </h1>
        <p className="mx-auto mt-3 max-w-[32ch] text-[15px] leading-relaxed text-white/55">
          שיתוף מיקום פשוט, בטוח ורק בין מי שהזמנתם.
        </p>
      </div>

      <ul className="space-y-2.5">
        {features.map((feature) => (
          <li key={feature.title} className="glass flex items-center gap-3.5 rounded-2xl p-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/8 text-xl">
              {feature.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-white">{feature.title}</p>
              <p className="text-[12.5px] text-white/45">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Button onClick={onNext} className="w-full">
          מתחילים
        </Button>
        <p className="text-center text-[11.5px] leading-relaxed text-white/35">
          {demo
            ? 'האפליקציה פועלת כרגע במצב הדגמה — הנתונים נשמרים רק במכשיר שלכם.'
            : 'המיקום משותף רק עם חברי המשפחה שהצטרפו עם קוד ההזמנה שלכם.'}
        </p>
      </div>
    </div>
  )
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 -start-16 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="absolute top-1/3 -end-20 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="absolute -bottom-24 start-1/4 h-72 w-72 rounded-full bg-mint-400/15 blur-3xl" />
    </div>
  )
}
