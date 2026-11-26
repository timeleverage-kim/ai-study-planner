import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './DdayCounter.css'

type Exam = {
  id: string
  name: string
  date: string // YYYY-MM-DD
  createdAt: number
}

const STORAGE_KEY = 'study-planner:exams'
const DAY_MS = 86_400_000

function loadExams(): Exam[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Exam[]) : []
  } catch {
    return []
  }
}

function saveExams(exams: Exam[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exams))
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

/** Local midnight of a YYYY-MM-DD string. */
function examStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function startOfToday(now: number): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Calendar-day difference (DST-safe via rounding). */
function daysLeft(date: string, now: number): number {
  return Math.round((examStart(date) - startOfToday(now)) / DAY_MS)
}

function ddayLabel(days: number): string {
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days}` : `D+${-days}`
}

function urgency(days: number): 'past' | 'today' | 'urgent' | 'soon' | 'calm' {
  if (days < 0) return 'past'
  if (days === 0) return 'today'
  if (days <= 7) return 'urgent'
  if (days <= 30) return 'soon'
  return 'calm'
}

const MESSAGES: Record<ReturnType<typeof urgency>, string> = {
  past: '수고했어요! 다음 목표를 세워 볼까요?',
  today: '오늘이 바로 그날! 실력을 믿으세요 💪',
  urgent: '마지막 스퍼트! 오답 위주로 정리해요',
  soon: '지금 페이스 유지하면 충분해요',
  calm: '여유 있을 때 기초를 탄탄하게',
}

function formatDate(date: string): string {
  return new Date(examStart(date)).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function DdayCounter() {
  const [exams, setExams] = useState<Exam[]>(loadExams)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const now = useNow()

  useEffect(() => saveExams(exams), [exams])

  // Upcoming first (nearest on top), past exams after.
  // Keyed on the calendar day so it re-sorts at midnight, not every second.
  const today = startOfToday(now)
  const sorted = useMemo(() => {
    return [...exams].sort((a, b) => {
      const da = daysLeft(a.date, today)
      const db = daysLeft(b.date, today)
      if (da < 0 !== db < 0) return da < 0 ? 1 : -1
      return da < 0 ? db - da : da - db
    })
  }, [exams, today])

  const featured = sorted.find((e) => e.id === selectedId) ?? sorted[0]

  function addExam(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !date) return
    const exam: Exam = {
      id: crypto.randomUUID(),
      name: name.trim(),
      date,
      createdAt: Date.now(),
    }
    setExams((prev) => [...prev, exam])
    setSelectedId(exam.id)
    setName('')
    setDate('')
  }

  function removeExam(id: string) {
    setExams((prev) => prev.filter((e) => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <section className="dday" aria-label="시험 D-Day 카운터">
      {featured ? (
        <FeaturedCard exam={featured} now={now} />
      ) : (
        <div className="dday-card dday-empty">
          <span className="dday-empty-icon" aria-hidden>
            🗓️
          </span>
          <p>등록된 시험이 없어요.</p>
          <p className="dday-sub">아래에서 시험을 추가하고 D-Day를 확인하세요.</p>
        </div>
      )}

      <form className="dday-form" onSubmit={addExam}>
        <input
          type="text"
          placeholder="시험 이름 (예: 정보처리기사 필기)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label="시험 이름"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="시험 날짜"
        />
        <button type="submit" disabled={!name.trim() || !date}>
          추가
        </button>
      </form>

      {sorted.length > 0 && (
        <ul className="dday-list">
          {sorted.map((exam) => {
            const days = daysLeft(exam.date, now)
            const active = exam.id === featured?.id
            return (
              <li key={exam.id} className={`dday-item is-${urgency(days)}${active ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="dday-item-main"
                  onClick={() => setSelectedId(exam.id)}
                  aria-pressed={active}
                >
                  <span className="dday-chip">{ddayLabel(days)}</span>
                  <span className="dday-item-name">{exam.name}</span>
                  <span className="dday-item-date">{formatDate(exam.date)}</span>
                </button>
                <button
                  type="button"
                  className="dday-remove"
                  onClick={() => removeExam(exam.id)}
                  aria-label={`${exam.name} 삭제`}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function FeaturedCard({ exam, now }: { exam: Exam; now: number }) {
  const days = daysLeft(exam.date, now)
  const level = urgency(days)

  const target = examStart(exam.date)
  const remaining = Math.max(0, target - now)
  const h = Math.floor((remaining % DAY_MS) / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1000)

  // Progress from when the exam was added to the exam day.
  const total = Math.max(1, target - exam.createdAt)
  const progress = Math.min(1, Math.max(0, (now - exam.createdAt) / total))

  return (
    <div className={`dday-card is-${level}`}>
      <div className="dday-glow" aria-hidden />
      <p className="dday-name">{exam.name}</p>
      <p className="dday-big" aria-live="off">
        {ddayLabel(days)}
      </p>
      <p className="dday-date">{formatDate(exam.date)}</p>

      {days > 0 && (
        <div className="dday-clock" aria-label="남은 시간">
          <TimeUnit value={String(Math.floor(remaining / DAY_MS))} label="일" />
          <TimeUnit value={pad(h)} label="시간" />
          <TimeUnit value={pad(m)} label="분" />
          <TimeUnit value={pad(s)} label="초" />
        </div>
      )}

      {days >= 0 && (
        <div className="dday-progress" aria-label={`준비 기간 ${Math.round(progress * 100)}% 경과`}>
          <div className="dday-progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <p className="dday-msg">{MESSAGES[level]}</p>
    </div>
  )
}

function TimeUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="dday-unit">
      <span className="dday-unit-value">{value}</span>
      <span className="dday-unit-label">{label}</span>
    </div>
  )
}
