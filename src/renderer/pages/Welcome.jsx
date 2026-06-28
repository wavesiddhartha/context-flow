import React, { useState, useEffect } from 'react'
import styles from '../styles/Welcome.module.css'

export default function Welcome({ platform, onNewSession }) {
  const [patterns, setPatterns] = useState([])
  const [stats, setStats] = useState({ sessions: 0, messages: 0 })

  useEffect(() => {
    loadPatterns()
    loadStats()
  }, [])

  async function loadPatterns() {
    if (!window.electronAPI) return
    const p = await window.electronAPI.getPatterns()
    setPatterns((p || []).slice(0, 8))
  }

  async function loadStats() {
    if (!window.electronAPI) return
    const sessions = await window.electronAPI.getSessions()
    const total = sessions?.length || 0
    const msgs = sessions?.reduce((acc, s) => acc + (s.message_count || 0), 0) || 0
    setStats({ sessions: total, messages: msgs })
  }

  async function captureNow() {
    if (!window.electronAPI) return
    const screenshot = await window.electronAPI.capture()
    if (screenshot) {
      const result = await window.electronAPI.saveSession({
        title: 'Manual capture',
        screenshotPath: screenshot.filepath,
        appName: '',
      })
      if (result?.id) {
        const session = await window.electronAPI.getSession(result.id)
        onNewSession?.(session)
      }
    }
  }

  const hotkey = platform?.hotkey?.label || '⌘⇧Space'

  return (
    <div className={styles.welcome}>
      {/* Background Atmosphere Globe */}
      <svg className={styles.globeAtmosphere} viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5">
        <circle cx="100" cy="100" r="90" />
        <path d="M 100 10 A 90 90 0 0 0 100 190" />
        <path d="M 100 10 A 60 90 0 0 0 100 190" />
        <path d="M 100 10 A 30 90 0 0 0 100 190" />
        <line x1="100" y1="10" x2="100" y2="190" />
        <path d="M 100 10 A 30 90 0 0 1 100 190" />
        <path d="M 100 10 A 60 90 0 0 1 100 190" />
        <path d="M 100 10 A 90 90 0 0 1 100 190" />
        <line x1="10" y1="100" x2="190" y2="100" />
        <path d="M 10 100 A 90 30 0 0 1 190 100" />
        <path d="M 10 100 A 90 60 0 0 1 190 100" />
        <path d="M 10 100 A 90 90 0 0 1 190 100" />
        <path d="M 23 50 Q 100 65 177 50" />
        <path d="M 23 150 Q 100 135 177 150" />
        <path d="M 43 25 Q 100 35 157 25" />
        <path d="M 43 175 Q 100 165 157 175" />
      </svg>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.logoMark}>
          <svg width="40" height="24" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7c0-3.5 4.5-3.5 9 0c4.5 3.5 9 3.5 9 0c0-3.5-4.5-3.5-9 0C7.5 10.5 3 10.5 3 7z" />
          </svg>
        </div>
        <h1 className={styles.title}>ContextFlow</h1>
        <p className={styles.subtitle}>
          Your AI debugging companion. Capture any screen and get instant analysis.
        </p>

        <div className={styles.hotkeyCard}>
          <div className={styles.hotkeyLeft}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>Press anywhere to capture</span>
          </div>
          <kbd className={styles.hotkeyKey}>{hotkey}</kbd>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.sessions}</span>
          <span className={styles.statLabel}>sessions</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.messages}</span>
          <span className={styles.statLabel}>messages</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statCard}>
          <span className={styles.statValue}>{patterns.length}</span>
          <span className={styles.statLabel}>tracked patterns</span>
        </div>
      </div>

      {/* How it works */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <div className={styles.steps}>
          {[
            {
              icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
              step: '01',
              title: 'Trigger',
              desc: `Press ${hotkey} anywhere. ContextFlow captures your active screen instantly.`,
            },
            {
              icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
              step: '02',
              title: 'Ask',
              desc: 'Type or speak your question. Voice input uses Whisper large-v3 for transcription.',
            },
            {
              icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
              step: '03',
              title: 'Analyze',
              desc: 'DeepSeek V4 reads the screenshot. Kimi K2 handles code. Run both in parallel.',
            },
            {
              icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
              step: '04',
              title: 'Remember',
              desc: 'Every session is stored. ContextFlow tracks your debug patterns over time.',
            },
          ].map(s => (
            <div key={s.step} className={styles.step}>
              <div className={styles.stepIcon} dangerouslySetInnerHTML={{ __html: s.icon }} />
              <div className={styles.stepBody}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNum}>{s.step}</span>
                  <span className={styles.stepTitle}>{s.title}</span>
                </div>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top patterns */}
      {patterns.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Your debug patterns</h2>
          <div className={styles.patterns}>
            {patterns.map(p => (
              <div key={p.id} className={styles.pattern}>
                <span className={styles.patternWord}>{p.keyword}</span>
                <span className={styles.patternCount}>{p.frequency}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className={styles.cta}>
        <button className={styles.captureBtn} onClick={captureNow}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
          Capture screen now
        </button>
      </div>
    </div>
  )
}
