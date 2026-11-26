import { useEffect, useState } from 'react'
import './App.css'
import DdayCounter from './components/DdayCounter'

function App() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ message: string }>
      })
      .then((data) => setMessage(data.message))
      .catch(() => setError(true))
  }, [])

  return (
    <main>
      <h1>📚 AI 스터디 플래너</h1>
      {error ? (
        <p>백엔드에 연결할 수 없습니다. bootRun을 확인하세요.</p>
      ) : (
        <p>{message ?? '불러오는 중...'}</p>
      )}
      <DdayCounter />
    </main>
  )
}

export default App
