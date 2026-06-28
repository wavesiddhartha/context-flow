import React, { useState } from 'react'
import styles from '../styles/Sidebar.module.css'

const icons = {
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  session: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  history: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  screenshot: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
}

function Icon({ svg }) {
  return <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display: 'flex', alignItems: 'center' }} />
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Sidebar({ sessions, activeId, onSelect, onDelete, onRefresh }) {
  const [search, setSearch] = useState('')
  const [hoverDelete, setHoverDelete] = useState(null)

  const filtered = sessions.filter(s =>
    !search || (s.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className={styles.sidebar}>
      {/* Branding */}
      <div className={styles.branding}>
        <svg className={styles.logoIcon} width="22" height="13" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7c0-3.5 4.5-3.5 9 0c4.5 3.5 9 3.5 9 0c0-3.5-4.5-3.5-9 0C7.5 10.5 3 10.5 3 7z" />
        </svg>
        <span className={styles.brandName}>
          Context<span className={styles.brandNameBold}>Flow</span>
        </span>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.label}>
          <Icon svg={icons.history} />
          <span>Sessions</span>
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh} title="Refresh">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}><Icon svg={icons.search} /></span>
        <input
          className={styles.search}
          placeholder="Search sessions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Session list */}
      <div className={styles.list}>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <Icon svg={icons.session} />
            <span>No sessions yet</span>
          </div>
        )}
        {filtered.map(session => (
          <button
            key={session.id}
            className={`${styles.item} ${activeId === session.id ? styles.active : ''}`}
            onClick={() => onSelect(session.id)}
            onMouseEnter={() => setHoverDelete(session.id)}
            onMouseLeave={() => setHoverDelete(null)}
          >
            <div className={styles.itemIcon}>
              <Icon svg={icons.screenshot} />
            </div>
            <div className={styles.itemBody}>
              <span className={styles.itemTitle}>{session.title || 'Untitled'}</span>
              <div className={styles.itemMeta}>
                <span>{formatTime(session.created_at)}</span>
                {session.message_count > 0 && (
                  <span className={styles.msgCount}>{session.message_count} msg</span>
                )}
              </div>
            </div>
            {hoverDelete === session.id && (
              <button
                className={styles.deleteBtn}
                onClick={e => { e.stopPropagation(); onDelete(session.id) }}
                title="Delete session"
              >
                <Icon svg={icons.trash} />
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerStat}>
          <span className={styles.statNum}>{sessions.length}</span>
          <span className={styles.statLabel}>total sessions</span>
        </div>
      </div>
    </aside>
  )
}
