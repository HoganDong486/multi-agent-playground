# Multi-Agent Playground

Interactive demo of collaborative AI agents: PM writes specs, Dev generates code, Reviewer audits.

## Quick Start

```bash
npm install
echo "VITE_OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

## Features

- **3-agent pipeline**: PM → Dev → Reviewer sequential workflow
- **Proactive mode**: PM auto-generates edge cases for Dev and Reviewer
- **Session persistence**: All workflows saved to localStorage
- **History browser**: View and reload past sessions

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- OpenAI-compatible API

---

### Part of the Hogan Dong Agent Stack

This is the **interactive demo** layer. For production-grade multi-agent orchestration, see:

> **[AgentForge](https://github.com/HoganDong486/agentforge)** — DAG-based workflow engine with memory, evaluation, and 30+ tools.
>
> Also: [Browser MCP](https://github.com/HoganDong486/opencode-browser-mcp) · [MCP Toolkit](https://github.com/HoganDong486/mcp-server-toolkit) · [RAG Agent](https://github.com/HoganDong486/rag-research-agent)
