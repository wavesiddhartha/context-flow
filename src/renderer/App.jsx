import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SessionView from './pages/SessionView'
import Welcome from './pages/Welcome'
import styles from './styles/App.module.css'

export default function App() {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [platform, setPlatform] = useState(null)

  useEffect(() => {
    loadSessions()
    loadPlatform()

    // Listen for new sessions created from overlay
    const interval = setInterval(loadSessions, 3000)
    return () => clearInterval(interval)
  }, [])

  async function loadSessions() {
    if (!window.electronAPI) return
    const data = await window.electronAPI.getSessions()
    setSessions(data || [])
  }

  async function loadPlatform() {
    if (!window.electronAPI) return
    const info = await window.electronAPI.getPlatform()
    setPlatform(info)
  }

  async function openSession(id) {
    if (!window.electronAPI) return
    const session = await window.electronAPI.getSession(id)
    setActiveSession(session)
  }

  async function deleteSession(id) {
    if (!window.electronAPI) return
    await window.electronAPI.deleteSession(id)
    if (activeSession?.id === id) setActiveSession(null)
    loadSessions()
  }

  function handleNewSession(session) {
    setSessions(prev => [session, ...prev])
    setActiveSession(session)
  }

  return (
    <div className={styles.app}>
      <div className={styles.titlebar + ' drag-region'}>
        <div className={styles.trafficLights} />
        <div className={styles.titlebarRight + ' no-drag'}>
          {platform && (
            <kbd className={styles.hotkeyBadge}>{platform.hotkey?.label}</kbd>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <Sidebar
          sessions={sessions}
          activeId={activeSession?.id}
          onSelect={openSession}
          onDelete={deleteSession}
          onRefresh={loadSessions}
        />
        <main className={styles.main}>
          <div className={styles.cardContainer}>
            {activeSession ? (
              <SessionView
                key={activeSession.id}
                session={activeSession}
                onUpdate={loadSessions}
              />
            ) : (
              <Welcome platform={platform} onNewSession={handleNewSession} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
