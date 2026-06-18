import { useState, useRef, useEffect } from 'react'

type Role = 'pm' | 'dev' | 'reviewer'
type Message = { role: Role; text: string }

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
const MODEL = import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini'

const PLANNING_KEY = 'agent_playground_sessions'

interface SavedSession {
  id: string
  task: string
  timestamp: number
  messages: Record<Role, string>
}

const ROLE_CONFIG = {
  pm: {
    label: 'PM',
    emoji: '\ud83d\udccc',
    color: 'border-blue-400 bg-blue-50',
    header: 'bg-blue-500',
    prompt: 'You are a Product Manager. Write a concise technical specification for the given task. Include requirements, scope, and success criteria. Keep it under 300 words.',
  },
  dev: {
    label: 'Dev',
    emoji: '\ud83d\udcbb',
    color: 'border-green-400 bg-green-50',
    header: 'bg-green-500',
    prompt: 'You are a Software Developer. Given a technical specification, write clean, production-ready code. Include comments and error handling. Keep it concise.',
  },
  reviewer: {
    label: 'Reviewer',
    emoji: '\ud83d\udd0d',
    color: 'border-purple-400 bg-purple-50',
    header: 'bg-purple-500',
    prompt: 'You are a Code Reviewer. Review the code against the spec. Identify bugs, suggest improvements, and give a verdict (Approve / Changes Requested). Be constructive.',
  },
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

function AgentPanel({ role, content, loading }: { role: Role; content: string; loading: boolean }) {
  const cfg = ROLE_CONFIG[role]
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content])

  return (
    <div className={`rounded-xl border-2 ${cfg.color} overflow-hidden shadow-sm`}>
      <div className={`${cfg.header} text-white px-4 py-2 font-semibold text-sm flex items-center gap-2`}>
        <span>{cfg.emoji}</span>
        <span>{cfg.label} Agent</span>
        {loading && <span className="ml-auto animate-blink text-xs opacity-80">thinking...</span>}
      </div>
      <div className="p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
        {content || (loading ? '\n' : <span className="text-gray-400 italic">Waiting for task...</span>)}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function App() {
  const [task, setTask] = useState('')
  const [messages, setMessages] = useState<Record<Role, string>>({ pm: '', dev: '', reviewer: '' })
  const [loading, setLoading] = useState<Record<Role, boolean>>({ pm: false, dev: false, reviewer: false })
  const [error, setError] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [proactiveMode, setProactiveMode] = useState(false)
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    setHasKey(!!API_KEY)
    const saved = localStorage.getItem(PLANNING_KEY)
    if (saved) setSessions(JSON.parse(saved))
  }, [])

  const saveSession = (msgs: Record<Role, string>) => {
    const session: SavedSession = {
      id: Date.now().toString(36),
      task: task.trim(),
      timestamp: Date.now(),
      messages: msgs,
    }
    const updated = [session, ...sessions].slice(0, 20)
    setSessions(updated)
    localStorage.setItem(PLANNING_KEY, JSON.stringify(updated))
  }

  const loadSession = (session: SavedSession) => {
    setTask(session.task)
    setMessages(session.messages)
    setShowHistory(false)
  }

  const deleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    localStorage.setItem(PLANNING_KEY, JSON.stringify(updated))
  }

  const runPipeline = async () => {
    if (!task.trim() || !API_KEY) return
    setError('')
    setMessages({ pm: '', dev: '', reviewer: '' })

    try {
      setLoading(prev => ({ ...prev, pm: true }))
      const spec = await callLLM(ROLE_CONFIG.pm.prompt, task)
      setMessages(prev => ({ ...prev, pm: spec }))
      setLoading(prev => ({ ...prev, pm: false }))

      setLoading(prev => ({ ...prev, dev: true }))
      const code = await callLLM(ROLE_CONFIG.dev.prompt, `Specification:\n${spec}`)
      setMessages(prev => ({ ...prev, dev: code }))
      setLoading(prev => ({ ...prev, dev: false }))

      setLoading(prev => ({ ...prev, reviewer: true }))
      const review = await callLLM(ROLE_CONFIG.reviewer.prompt, `Specification:\n${spec}\n\nCode:\n${code}`)
      const finalMsgs = { pm: spec, dev: code, reviewer: review }
      setMessages(finalMsgs)
      setLoading(prev => ({ ...prev, reviewer: false }))

      saveSession(finalMsgs)
    } catch (e: any) {
      setError(e.message)
      setLoading({ pm: false, dev: false, reviewer: false })
    }
  }

  const runProactive = async () => {
    if (!task.trim() || !API_KEY) return
    setError('')

    try {
      setLoading(prev => ({ ...prev, pm: true }))
      const proactivePrompt = ROLE_CONFIG.pm.prompt + ' After writing the spec, also generate 1-2 specific test scenarios or edge cases the developer and reviewer should check.'
      const spec = await callLLM(proactivePrompt, task)
      setMessages(prev => ({ ...prev, pm: spec }))
      setLoading(prev => ({ ...prev, pm: false }))

      setLoading(prev => ({ ...prev, dev: true }))
      const code = await callLLM(ROLE_CONFIG.dev.prompt, `Specification:\n${spec}\n\nWrite code that handles both the core requirements and the edge cases mentioned above.`)
      setMessages(prev => ({ ...prev, dev: code }))
      setLoading(prev => ({ ...prev, dev: false }))

      setLoading(prev => ({ ...prev, reviewer: true }))
      const review = await callLLM(ROLE_CONFIG.reviewer.prompt, `Specification:\n${spec}\n\nCode:\n${code}\n\nSpecifically check whether the edge cases mentioned in the spec are properly handled.`)
      const finalMsgs = { pm: spec, dev: code, reviewer: review }
      setMessages(finalMsgs)
      setLoading(prev => ({ ...prev, reviewer: false }))

      saveSession(finalMsgs)
    } catch (e: any) {
      setError(e.message)
      setLoading({ pm: false, dev: false, reviewer: false })
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Multi-Agent Playground
          </h1>
          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-200">v2.0</span>
        </div>
        <p className="text-gray-500 text-sm">
          Simulate a collaborative software team: PM writes specs, Dev generates code, Reviewer audits.
        </p>
      </header>

      {!hasKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 text-center">
          Set <code className="bg-amber-100 px-1 rounded">VITE_OPENAI_API_KEY</code> in <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable live LLM calls.
          <br />You can also use any OpenAI-compatible API by setting <code className="bg-amber-100 px-1 rounded">VITE_OPENAI_BASE_URL</code>.
        </div>
      )}

      <div className="flex gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setProactiveMode(!proactiveMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${proactiveMode ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
          >
            {'\u26a1'} Proactive
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${showHistory ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
          >
            {'\ud83d\udccb'} History ({sessions.length})
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') proactiveMode ? runProactive() : runPipeline() }}
          placeholder={proactiveMode ? "Describe a task (Proactive mode: auto-generates edge cases)..." : "Describe a task... e.g. 'Build a REST API for a todo app'"}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={!hasKey}
        />
        <button
          onClick={proactiveMode ? runProactive : runPipeline}
          disabled={!task.trim() || !hasKey || loading.pm || loading.dev || loading.reviewer}
          className={`px-6 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-colors ${proactiveMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {proactiveMode ? 'Run Proactive' : 'Run'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
      )}

      {showHistory && (
        <div className="mb-6 bg-white border border-gray-100 rounded-xl p-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Previous Sessions (persistent in browser)</h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400">No saved sessions yet. Run a pipeline to save.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <button onClick={() => loadSession(s)} className="text-left flex-1 hover:text-indigo-600 transition-colors truncate mr-2" title={s.task}>
                    <span className="text-gray-400">{new Date(s.timestamp).toLocaleString()}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="text-gray-700">{s.task}</span>
                  </button>
                  <button onClick={() => deleteSession(s.id)} className="text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0">
                    {'\u2715'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <AgentPanel role="pm" content={messages.pm} loading={loading.pm} />
        <AgentPanel role="dev" content={messages.dev} loading={loading.dev} />
        <AgentPanel role="reviewer" content={messages.reviewer} loading={loading.reviewer} />
      </div>

      <div className="mt-8 text-center">
        <div className="flex justify-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span> PM writes spec
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400"></span> Dev generates code
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span> Reviewer audits
          </span>
        </div>
        <p className="text-xs text-gray-300 mt-2">
          {proactiveMode ? 'Proactive mode: PM auto-generates edge cases, Dev and Reviewer check them.' : 'All sessions auto-saved to browser storage.'}
        </p>
      </div>
    </div>
  )
}

export default App
