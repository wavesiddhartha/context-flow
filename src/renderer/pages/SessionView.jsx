import React, { useState, useRef, useEffect } from 'react'
import MessageBubble from '../components/MessageBubble'
import { analyzeScreenshot, askCodingModel } from '../services/nvidia'
import styles from '../styles/SessionView.module.css'

export default function SessionView({ session, onUpdate }) {
  const [messages, setMessages] = useState(session.messages || [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showScreen, setShowScreen] = useState(true)
  const [activeModel, setActiveModel] = useState('vision')

  const inputRef = useRef(null)
  const bottomRef = useRef(null)
  const screenshotDataUrl = session.screenshot_path
    ? `contextflow-file://${session.screenshot_path}`
    : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const query = input.trim()
    if (!query || busy) return

    setInput('')
    const userMsg = { id: Date.now(), role: 'user', content: query }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setBusy(true)

    if (window.electronAPI) {
      await window.electronAPI.saveMessage({ sessionId: session.id, role: 'user', content: query })
    }

    const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: '', streaming: true }
    setMessages([...newMessages, assistantMsg])

    let fullResponse = ''
    const history = newMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const opts = {
        query,
        history,
        onChunk: (_, full) => {
          fullResponse = full
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id ? { ...m, content: full } : m
          ))
        },
      }

      if (activeModel === 'vision' && session.screenshot_path) {
        // Load screenshot for this session
        const fs = window.require?.('fs')
        let base64 = ''
        if (fs) {
          try { base64 = fs.readFileSync(session.screenshot_path).toString('base64') } catch {}
        }
        await analyzeScreenshot({ ...opts, imageBase64: base64 })
      } else {
        await askCodingModel(opts)
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, content: fullResponse, streaming: false } : m
      ))

      if (window.electronAPI) {
        await window.electronAPI.saveMessage({ sessionId: session.id, role: 'assistant', content: fullResponse })
      }

      onUpdate?.()
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: `**Error:** ${err.message}`, streaming: false, error: true }
          : m
      ))
    }

    setBusy(false)
    inputRef.current?.focus()
  }

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  return (
    <div className={styles.view}>
      {/* Session header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.sessionIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </div>
          <div>
            <h2 className={styles.sessionTitle}>{session.title || 'Untitled Session'}</h2>
            <span className={styles.sessionDate}>{formatDate(session.created_at)}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {session.screenshot_path && (
            <button
              className={`${styles.toggleScreenBtn} ${showScreen ? styles.active : ''}`}
              onClick={() => setShowScreen(!showScreen)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
              {showScreen ? 'Hide' : 'Show'} screenshot
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {/* Screenshot panel */}
        {showScreen && session.screenshot_path && (
          <div className={styles.screenshotPanel}>
            <div className={styles.screenshotHeader}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              <span>Captured screenshot</span>
            </div>
            <div className={styles.screenshotImg}>
              <img
                src={screenshotDataUrl || ''}
                alt="Session screenshot"
                onError={e => { e.target.style.display = 'none' }}
              />
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className={styles.chat}>
          {/* Model selector */}
          <div className={styles.modelBar}>
            {[
              { id: 'vision', label: 'Vision (DeepSeek V4)', icon: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>` },
              { id: 'coding', label: 'Code (Kimi K2)', icon: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>` },
            ].map(m => (
              <button
                key={m.id}
                className={`${styles.modelBtn} ${activeModel === m.id ? styles.modelActive : ''}`}
                onClick={() => setActiveModel(m.id)}
              >
                <span dangerouslySetInnerHTML={{ __html: m.icon }} />
                {m.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>Ask a question about this session's screenshot</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={styles.inputArea}>
            <div className={styles.inputWrap}>
              <textarea
                ref={inputRef}
                className={styles.input}
                placeholder={busy ? 'Analyzing…' : 'ask about session...'}
                value={input}
                disabled={busy}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                rows={1}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
              />
              <button
                className={styles.sendBtn}
                onClick={sendMessage}
                disabled={!input.trim() || busy}
              >
                {busy ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/>
                    <polyline points="5 12 12 5 19 12"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
