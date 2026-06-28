import React, { useState, useEffect, useRef } from 'react'
import { analyzeScreenshot, askCodingModel } from '../services/nvidia'
import MessageBubble from '../components/MessageBubble'
import styles from '../styles/Overlay.module.css'

const MODE = { IDLE: 'idle', THINKING: 'thinking', STREAMING: 'streaming' }

export default function Overlay() {
  const [screenshot, setScreenshot] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState(MODE.IDLE)
  const [sessionId, setSessionId] = useState(null)
  const [activeModel, setActiveModel] = useState('vision') // vision | coding
  const [overlayMode, setOverlayMode] = useState('compact')

  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // ── Receive screenshot from main process ──
  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onScreenshot((data) => {
      setScreenshot(data)
      setMessages([])
      setSessionId(null)
      setMode(MODE.IDLE)
      setTimeout(() => inputRef.current?.focus(), 100)
    })
    return cleanup
  }, [])

  // ── Sync mode changes from Electron (e.g. on double-press hotkey) ──
  useEffect(() => {
    if (!window.electronAPI) return
    const cleanupSetMode = window.electronAPI.onSetMode((m) => {
      setOverlayMode(m)
    })
    return cleanupSetMode
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        close()
        return
      }

      if (overlayMode === 'compact') {
        if (e.key.length === 1 || e.key === 'Enter') {
          toggleExpand()
          setTimeout(() => {
            inputRef.current?.focus()
          }, 150)
        }
      } else {
        if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
          e.preventDefault()
          sendMessage()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [input, overlayMode])

  // ── Auto scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function close() {
    if (window.electronAPI) window.electronAPI.closeOverlay()
  }

  function openWorkspace() {
    if (window.electronAPI) window.electronAPI.openMain()
  }

  function toggleExpand() {
    const nextMode = overlayMode === 'compact' ? 'expanded' : 'compact'
    setOverlayMode(nextMode)
    if (window.electronAPI) {
      window.electronAPI.setSize(nextMode)
    }
  }

  // ── Save to DB ──
  async function ensureSession(firstMessage) {
    if (sessionId) return sessionId
    if (!window.electronAPI) return null

    const result = await window.electronAPI.saveSession({
      title: firstMessage.slice(0, 60),
      screenshotPath: screenshot?.filepath || '',
      appName: screenshot?.appName || '',
    })
    const newId = result?.id || null
    setSessionId(newId)
    return newId
  }

  async function saveMessage(sid, role, content) {
    if (!window.electronAPI || !sid) return
    await window.electronAPI.saveMessage({ sessionId: sid, role, content })
  }

  // ── Send message ──
  async function sendMessage(text) {
    const query = (text || input).trim()
    if (!query || mode !== MODE.IDLE) return

    if (overlayMode === 'compact') {
      toggleExpand()
    }

    setInput('')
    const userMsg = { role: 'user', content: query, id: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setMode(MODE.THINKING)

    const sid = await ensureSession(query)
    await saveMessage(sid, 'user', query)

    // Track keywords
    if (window.electronAPI) {
      query.split(/\s+/).filter(w => w.length > 4).forEach(w =>
        window.electronAPI.updatePattern(w.toLowerCase())
      )
    }

    // AI response placeholder
    const assistantMsg = { role: 'assistant', content: '', id: Date.now() + 1, streaming: true }
    setMessages([...newMessages, assistantMsg])
    setMode(MODE.STREAMING)

    let fullResponse = ''

    try {
      if (screenshot?.base64) {
        await analyzeScreenshot({
          imageBase64: screenshot.base64,
          query,
          onChunk: (chunk, reasoning) => {
            if (chunk) fullResponse += chunk
            setMessages(prev => prev.map(m =>
              m.id === assistantMsg.id ? { ...m, content: fullResponse, reasoning_content: reasoning } : m
            ))
          }
        })
      } else {
        await askCodingModel({
          messages: [{ role: 'user', content: query }],
          onChunk: (chunk, reasoning) => {
            if (chunk) fullResponse += chunk
            setMessages(prev => prev.map(m =>
              m.id === assistantMsg.id ? { ...m, content: fullResponse, reasoning_content: reasoning } : m
            ))
          }
        })
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, content: fullResponse, streaming: false } : m
      ))
      await saveMessage(sid, 'assistant', fullResponse)

    } catch (err) {
      const errMsg = `**Error:** ${err.message || 'Request failed. Check your API keys.'}`
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, content: errMsg, streaming: false, error: true } : m
      ))
    }

    setMode(MODE.IDLE)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const isBusy = mode !== MODE.IDLE

  // ── Compact HUD View ──
  if (overlayMode === 'compact') {
    return (
      <div className={styles.compactHUD + ' animate-fadeIn'}>
        {/* The Idle Indicator Line (gray outline capsule from last screenshot) */}
        <div className={styles.hudIndicatorLine} />
        
        <div className={styles.hudExpandedContent}>
          {/* Option Buttons */}
          <div className={styles.hudButtons}>
            {/* PR Interactive Selection Capture Trigger */}
            <button
              className={styles.hudCircleBtn}
              onClick={async (e) => {
                e.stopPropagation()
                if (window.electronAPI) {
                  const res = await window.electronAPI.captureInteractive()
                  if (res) {
                    setScreenshot(res)
                  }
                }
              }}
              title="PR (Interactive active window selector)"
            >
              <span className={styles.hudBtnText}>PR</span>
            </button>

            {/* Expand Chat Panel Trigger */}
            <button
              className={styles.hudCircleBtn}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand()
              }}
              title="Expand conversation"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Expanded Conversation View ──
  return (
    <div className={styles.overlay + ' animate-slideUp'}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="20" height="12" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7c0-3.5 4.5-3.5 9 0c4.5 3.5 9 3.5 9 0c0-3.5-4.5-3.5-9 0C7.5 10.5 3 10.5 3 7z" />
            </svg>
          </div>
        </div>
        <div className={styles.headerRight}>
          {/* Manual active window selector */}
          <button
            className={styles.collapseBtn}
            onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.captureInteractive()
                if (res) setScreenshot(res)
              }
            }}
            title="Interactive window selector"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="22" y2="12"/>
            </svg>
          </button>
          
          <button className={styles.collapseBtn} onClick={toggleExpand} title="Collapse to HUD">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
            </svg>
          </button>
          <button className={styles.workspaceBtn} onClick={openWorkspace} title="Open workspace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button className={styles.closeBtn} onClick={close}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Screenshot preview */}
      {screenshot && (
        <div
          className={styles.screenshotBar}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            if (window.electronAPI && screenshot.filepath) {
              window.electronAPI.openFile(screenshot.filepath)
            }
          }}
          title="Click to open screenshot in Preview"
        >
          <div className={styles.screenshotThumb}>
            <img src={screenshot.dataUrl} alt="Captured screen" />
          </div>
          <div className={styles.screenshotMeta}>
            <span className={styles.screenshotLabel}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              {screenshot.appName || 'Active Window'} captured (Click to open)
            </span>
            <span className={styles.screenshotTime}>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p className={styles.emptyText}>Ask anything about the captured active window</p>
            <div className={styles.suggestions}>
              {["What's the error here?", "How do I fix this?", "Explain this code"].map(s => (
                <button key={s} className={styles.suggestion} onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrap}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder={isBusy ? 'Analyzing…' : 'ask about screenshot...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isBusy}
            rows={1}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
          />
          <div className={styles.inputActions}>
            {/* Send button */}
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={!input.trim() || isBusy}
            >
              {mode === MODE.THINKING || mode === MODE.STREAMING ? (
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
        <div className={styles.inputHint}>
          <kbd>↵</kbd> send · <kbd>⇧↵</kbd> newline · <kbd>Esc</kbd> close
        </div>
      </div>
    </div>
  )
}
