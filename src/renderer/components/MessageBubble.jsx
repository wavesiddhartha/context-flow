import React from 'react'
import styles from '../styles/MessageBubble.module.css'

function highlightSyntax(code) {
  if (!code) return ''
  // Color comments (grey)
  let highlighted = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g, '<span style="color: #7f848e; font-style: italic;">$1</span>')
  // Color strings (green)
  highlighted = highlighted.replace(/(["'`])(.*?)\1/g, '<span style="color: #98c379;">$1$2$1</span>')
  // Color keywords (purple)
  const keywords = /\b(const|let|var|function|return|import|export|from|default|class|extends|if|else|for|while|async|await|try|catch|throw|new|typeof|instanceof|def|import|as|from|print|class|pass|lambda|yield)\b/g
  highlighted = highlighted.replace(keywords, '<span style="color: #c678dd; font-weight: 600;">$1</span>')
  // Color builtins & types (gold)
  const builtins = /\b(document|window|console|Object|Array|String|Number|Boolean|Promise|Error|Map|Set|self|None|True|False)\b/g
  highlighted = highlighted.replace(builtins, '<span style="color: #e5c07b;">$1</span>')
  // Color numbers (orange)
  highlighted = highlighted.replace(/\b(\d+)\b/g, '<span style="color: #d19a66;">$1</span>')
  // Color functions (blue)
  highlighted = highlighted.replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span style="color: #61afef;">$1</span>')
  return highlighted
}

// Minimal markdown renderer (no external deps)
function renderMarkdown(text) {
  if (!text) return ''

  let html = text
    // Code blocks with high-contrast headers, dividers, and copy icons
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const highlighted = highlightSyntax(escaped.trimEnd())
      const displayLang = (lang || 'code').toUpperCase()
      const copyVal = escaped.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
      
      return `<pre class="code-block"><div class="code-header"><span class="code-lang">${displayLang}</span><button class="code-copy-btn" onclick="navigator.clipboard.writeText(\`${copyVal}\`)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div><div class="code-divider"></div><code>${highlighted}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr"/>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul class="md-ul">$1</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')

  return `<p>${html}</p>`
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<(?:pre|ul|ol|h[123]|hr))/g, '$1')
    .replace(/(<\/(?:pre|ul|ol|h[123]|hr)>)<\/p>/g, '$1')
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isEmpty = !message.content && message.streaming
  const reasoning = message.reasoning_content || message.reasoning

  return (
    <div className={`${styles.bubble} ${isUser ? styles.user : styles.assistant} animate-fadeIn`}>
      {/* Monospace spaced role indicators */}
      <div className={styles.roleTag}>
        {isUser ? 'YOU' : 'ASSISTANT'}
        {message.streaming && (
          <span className={styles.streamingDot} />
        )}
      </div>

      {/* Content */}
      <div className={`${styles.content} selectable`}>
        {reasoning && (
          <details className={styles.reasoningBlock} open={message.streaming}>
            <summary className={styles.reasoningSummary}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              {message.streaming ? 'Thinking…' : 'Thought Process'}
            </summary>
            <div className={styles.reasoningContent}>
              {reasoning}
            </div>
          </details>
        )}

        {isEmpty ? (
          <div className={styles.thinkingDots}>
            <span /><span /><span />
          </div>
        ) : isUser ? (
          <p className={styles.userText}>{message.content}</p>
        ) : (
          <div
            className={styles.markdownContent}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </div>
    </div>
  )
}
