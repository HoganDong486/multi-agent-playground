import { useState, useRef, useEffect } from 'react'

type Role = 'pm' | 'dev' | 'reviewer'
type Message = { role: Role; text: string }

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
const MODEL = import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini'

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

  useEffect(() => {
    setHasKey(!!API_KEY)
  }, [])

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
      setMessages(prev => ({ ...prev, reviewer: review }))
      setLoading(prev => ({ ...prev, reviewer: false }))
    } catch (e: any) {
      setError(e.message)
      setLoading({ pm: false, dev: false, reviewer: false })
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Multi-Agent Playground
        </h1>
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

      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runPipeline() }}
          placeholder="Describe a task... e.g. 'Build a REST API for a todo app'"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={!hasKey}
        />
        <button
          onClick={runPipeline}
          disabled={!task.trim() || !hasKey || loading.pm || loading.dev || loading.reviewer}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          Run
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
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
      </div>
    </div>
  )
}

export default App
