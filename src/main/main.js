const { app, BrowserWindow, globalShortcut, screen, ipcMain, Tray, Menu, nativeImage, desktopCapturer, systemPreferences, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let overlayWindow = null
let tray = null
let db = null

// ─── Database setup ───────────────────────────────────────────────
function initDB() {
  try {
    const Database = require('better-sqlite3')
    const dbPath = path.join(app.getPath('userData'), 'contextflow.db')
    db = new Database(dbPath)

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        title TEXT,
        screenshot_path TEXT,
        app_name TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT CHECK(role IN ('user','assistant')),
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT,
        frequency INTEGER DEFAULT 1,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Simple schema migrations for columns that might be missing in pre-existing DBs
    try {
      db.prepare("SELECT screenshot_path FROM sessions LIMIT 1").get()
    } catch (err) {
      try {
        db.exec("ALTER TABLE sessions ADD COLUMN screenshot_path TEXT")
        console.log('[DB] Migrated: added screenshot_path column')
      } catch (e) {
        console.error('[DB] Migration failed for screenshot_path:', e.message)
      }
    }

    try {
      db.prepare("SELECT app_name FROM sessions LIMIT 1").get()
    } catch (err) {
      try {
        db.exec("ALTER TABLE sessions ADD COLUMN app_name TEXT")
        console.log('[DB] Migrated: added app_name column')
      } catch (e) {
        console.error('[DB] Migration failed for app_name:', e.message)
      }
    }

    console.log('[DB] Initialized at', dbPath)
  } catch (err) {
    console.error('[DB] Init failed:', err.message)
  }
}

// ─── Main window (workspace / session browser) ────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  })

  const url = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../../dist/renderer/index.html')}`
  mainWindow.loadURL(url)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Overlay window ───────────────────────────────────────────────
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = 320
  const windowHeight = 56
  const x = Math.round(width / 2 - windowWidth / 2)
  const y = Math.round(height - windowHeight - 40)

  overlayWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  // Float above fullscreen apps and stick across all virtual desktops (Spaces)
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  const url = isDev
    ? 'http://localhost:5173/#overlay'
    : `file://${path.join(__dirname, '../../dist/renderer/index.html')}#overlay`

  overlayWindow.loadURL(url)

  overlayWindow.on('blur', () => {
    // Don't auto-hide if user is interacting
  })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

// ─── Screenshot capture ───────────────────────────────────────────
const { execSync, spawn } = require('child_process')

async function captureActiveWindow() {
  if (process.platform !== 'darwin') {
    return await captureScreen()
  }

  try {
    const appleScript = `
      tell application "System Events"
        try
          set activeProcess to first process whose frontmost is true
          if (name of activeProcess is "Electron") or (name of activeProcess is "ContextFlow") then
            set processList to every process whose visible is true and name is not "Electron" and name is not "ContextFlow"
            if (count of processList) > 0 then
              set activeProcess to item 1 of processList
            end if
          end if
          set frontWindow to first window of activeProcess
          set windowBounds to bounds of frontWindow
          return windowBounds
        on error
          return "FAIL"
        end try
      end tell
    `
    const boundsStr = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf8' }).trim()
    if (boundsStr === "FAIL") {
      return await captureScreen()
    }
    const bounds = boundsStr.split(',').map(n => parseInt(n.trim(), 10))

    if (bounds.length === 4) {
      const left = bounds[0]
      const top = bounds[1]
      const right = bounds[2]
      const bottom = bounds[3]
      const width = right - left
      const height = bottom - top

      const screenshotsDir = path.join(app.getPath('userData'), 'screenshots')
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

      const filename = `screenshot_${Date.now()}.png`
      const filepath = path.join(screenshotsDir, filename)

      execSync(`screencapture -R${left},${top},${width},${height} "${filepath}"`)

      const buffer = fs.readFileSync(filepath)
      const base64 = buffer.toString('base64')
      return { filepath, base64, dataUrl: `data:image/png;base64,${base64}` }
    }
  } catch (err) {
    console.warn('[ActiveWindowCapture] Failed, falling back to full screen:', err.message)
  }

  return await captureScreen()
}

async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })

    if (!sources.length) return null

    const source = sources[0]
    const thumbnail = source.thumbnail

    const screenshotsDir = path.join(app.getPath('userData'), 'screenshots')
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

    const filename = `screenshot_${Date.now()}.png`
    const filepath = path.join(screenshotsDir, filename)
    fs.writeFileSync(filepath, thumbnail.toPNG())

    const base64 = thumbnail.toPNG().toString('base64')
    return { filepath, base64, dataUrl: `data:image/png;base64,${base64}` }
  } catch (err) {
    console.error('[Screenshot] Failed:', err.message)
    return null
  }
}

async function captureInteractive() {
  if (process.platform !== 'darwin') {
    return await captureScreen()
  }

  try {
    const screenshotsDir = path.join(app.getPath('userData'), 'screenshots')
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

    const filename = `screenshot_${Date.now()}.png`
    const filepath = path.join(screenshotsDir, filename)

    // Hide overlay window first
    const wasVisible = overlayWindow && overlayWindow.isVisible()
    if (wasVisible) {
      overlayWindow.hide()
      await new Promise(resolve => setTimeout(resolve, 150)) // Wait for hide animation
    }

    // Run interactive window capture (macOS camera selection cursor)
    try {
      execSync(`screencapture -i -w "${filepath}"`)
    } catch (e) {
      console.warn('[InteractiveCapture] Cancelled or failed:', e.message)
    }

    if (fs.existsSync(filepath)) {
      const buffer = fs.readFileSync(filepath)
      const base64 = buffer.toString('base64')
      const dataUrl = `data:image/png;base64,${base64}`

      // Fetch active application name using AppleScript
      let appName = 'Active Window'
      try {
        appName = execSync("osascript -e 'tell application \"System Events\" to get name of first process whose frontmost is true'", { encoding: 'utf8' }).trim()
      } catch (err) {
        console.warn('[InteractiveCapture] Failed to get app name:', err.message)
      }

      const screenshot = { filepath, base64, dataUrl, appName }

      // Reshow and focus overlay
      if (overlayWindow) {
        overlayWindow.webContents.send('overlay:set-mode', 'expanded')
        resizeOverlay('expanded')
        overlayWindow.show()
        overlayWindow.focus()
        overlayWindow.webContents.send('screenshot-ready', screenshot)
      }
      return screenshot
    } else {
      // Cancelled
      if (overlayWindow) {
        overlayWindow.show()
        overlayWindow.focus()
      }
      return null
    }
  } catch (err) {
    console.error('[InteractiveCapture] Error:', err.message)
    if (overlayWindow) {
      overlayWindow.show()
      overlayWindow.focus()
    }
    return null
  }
}

// ─── Hotkey registration ──────────────────────────────────────────
function detectPlatformHotkey() {
  const platform = process.platform
  if (platform === 'darwin') {
    return { primary: 'Command+Shift+Space', label: '⌘⇧Space', platform: 'macOS' }
  } else if (platform === 'win32') {
    return { primary: 'Control+Shift+Space', label: 'Ctrl+Shift+Space', platform: 'Windows' }
  } else {
    return { primary: 'Control+Shift+Space', label: 'Ctrl+Shift+Space', platform: 'Linux' }
  }
}

async function triggerOverlay() {
  const wasVisible = overlayWindow && overlayWindow.isVisible()
  if (wasVisible) {
    overlayWindow.hide()
    await new Promise(resolve => setTimeout(resolve, 80))
  }

  const screenshot = await captureInteractive()

  if (!overlayWindow) {
    createOverlayWindow()
    const url = isDev
      ? 'http://localhost:5173/#overlay'
      : `file://${path.join(__dirname, '../../dist/renderer/index.html')}#overlay`
    overlayWindow.loadURL(url)
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  if (overlayWindow && screenshot) {
    overlayWindow.webContents.send('overlay:set-mode', 'expanded')
    resizeOverlay('expanded')
    overlayWindow.show()
    overlayWindow.focus()
    overlayWindow.webContents.send('screenshot-ready', screenshot)
  }
}

function registerHotkeys() {
  const hotkey = detectPlatformHotkey()
  console.log(`[Hotkey] Registering ${hotkey.primary} on ${hotkey.platform}`)

  const registered = globalShortcut.register(hotkey.primary, triggerOverlay)

  if (!registered) {
    console.warn('[Hotkey] Primary hotkey failed, trying fallback')
    globalShortcut.register('Alt+Space', triggerOverlay)
  }

  // Also register double-modifier detection via secondary shortcut
  globalShortcut.register('CommandOrControl+Shift+`', triggerOverlay)
}

// ─── Tray ─────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('ContextFlow')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Capture Active Window', click: triggerOverlay },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', triggerOverlay)
}

// ─── IPC handlers ─────────────────────────────────────────────────
function resizeOverlay(mode) {
  if (!overlayWindow) return
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  if (mode === 'compact') {
    const windowWidth = 320
    const windowHeight = 56
    const x = Math.round((screenWidth - windowWidth) / 2)
    const y = Math.round(screenHeight - windowHeight - 40)
    if (overlayWindow.setHasShadow) overlayWindow.setHasShadow(false)
    overlayWindow.setBounds({ x, y, width: windowWidth, height: windowHeight }, true)
  } else {
    const windowWidth = 440
    const windowHeight = 440
    const x = Math.round((screenWidth - windowWidth) / 2)
    const y = Math.round(screenHeight - windowHeight - 40)
    if (overlayWindow.setHasShadow) overlayWindow.setHasShadow(true)
    overlayWindow.setBounds({ x, y, width: windowWidth, height: windowHeight }, true)
  }
}

let keymonitorProcess = null
function startKeyMonitor() {
  if (process.platform !== 'darwin') return
  try {
    const swiftPath = path.join(__dirname, 'keymonitor.swift')
    keymonitorProcess = spawn('swift', [swiftPath])

    keymonitorProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim()
      if (msg.includes('DOUBLE_COMMAND') || msg.includes('DOUBLE_OPTION') || msg.includes('DOUBLE_SHIFT')) {
        console.log('[KeyMonitor] Double press detected:', msg)
        triggerOverlay()
      }
    })

    keymonitorProcess.stderr.on('data', (data) => {
      console.error('[KeyMonitor] Error:', data.toString())
    })

    keymonitorProcess.on('close', (code) => {
      console.log('[KeyMonitor] Process exited with code', code)
    })
  } catch (err) {
    console.error('[KeyMonitor] Failed to start:', err.message)
  }
}

function registerIPC() {
  // Close overlay
  ipcMain.on('overlay:close', () => {
    if (overlayWindow) overlayWindow.hide()
  })

  // Set size
  ipcMain.on('overlay:set-size', (_, mode) => {
    resizeOverlay(mode)
  })

  // Open main window
  ipcMain.on('overlay:open-main', () => {
    if (overlayWindow) overlayWindow.hide()
    if (mainWindow) mainWindow.show()
    else createMainWindow()
  })

  // Save session
  ipcMain.handle('db:save-session', (_, { title, screenshotPath, appName }) => {
    if (!db) return null
    try {
      const stmt = db.prepare('INSERT INTO sessions (title, screenshot_path, app_name, created_at) VALUES (?, ?, ?, datetime(\'now\'))')
      const result = stmt.run(title || 'Untitled Session', screenshotPath || '', appName || '')
      return { id: Number(result.lastInsertRowid) }
    } catch (err) {
      console.error('[DB] Save session error:', err.message)
      return null
    }
  })

  // Save message
  ipcMain.handle('db:save-message', (_, { sessionId, role, content }) => {
    if (!db) return null
    try {
      const stmt = db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
      const result = stmt.run(Number(sessionId), role, content)
      return { id: Number(result.lastInsertRowid) }
    } catch (err) {
      console.error('[DB] Save message error:', err.message)
      return null
    }
  })

  // Get all sessions
  ipcMain.handle('db:get-sessions', () => {
    if (!db) return []
    try {
      return db.prepare(`
        SELECT s.*, COUNT(m.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT 100
      `).all()
    } catch (err) {
      return []
    }
  })

  // Get session with messages
  ipcMain.handle('db:get-session', (_, id) => {
    if (!db) return null
    try {
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
      const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(id)
      return { ...session, messages }
    } catch (err) {
      return null
    }
  })

  // Delete session
  ipcMain.handle('db:delete-session', (_, id) => {
    if (!db) return false
    try {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
      return true
    } catch (err) {
      return false
    }
  })

  // Open file in default system app (macOS Preview)
  ipcMain.handle('app:open-file', async (_, filepath) => {
    if (filepath && fs.existsSync(filepath)) {
      await shell.openPath(filepath)
      return true
    }
    return false
  })



  // Get platform info
  ipcMain.handle('app:platform', () => {
    const hotkey = detectPlatformHotkey()
    return { platform: process.platform, hotkey }
  })

  // Capture screenshot on demand
  ipcMain.handle('app:capture', async () => {
    const wasVisible = overlayWindow && overlayWindow.isVisible()
    if (wasVisible) {
      overlayWindow.hide()
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    const screenshot = await captureActiveWindow()
    if (overlayWindow && wasVisible) {
      overlayWindow.show()
      overlayWindow.focus()
      overlayWindow.webContents.send('screenshot-ready', screenshot)
    }
    return screenshot
  })

  // Capture screenshot interactive
  ipcMain.handle('app:capture-interactive', async () => {
    return await captureInteractive()
  })

  // Update patterns
  ipcMain.on('db:update-pattern', (_, keyword) => {
    if (!db || !keyword) return
    try {
      const existing = db.prepare('SELECT id FROM patterns WHERE keyword = ?').get(keyword)
      if (existing) {
        db.prepare('UPDATE patterns SET frequency = frequency + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(existing.id)
      } else {
        db.prepare('INSERT INTO patterns (keyword) VALUES (?)').run(keyword)
      }
    } catch (err) { /* ignore */ }
  })

  // Get top patterns
  ipcMain.handle('db:get-patterns', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM patterns ORDER BY frequency DESC LIMIT 20').all()
    } catch (err) {
      return []
    }
  })
}

// ─── App lifecycle ────────────────────────────────────────────────
app.whenReady().then(() => {
  initDB()
  registerIPC()
  
  // Run headlessly in the macOS menu bar
  createTray()
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  registerHotkeys()
  startKeyMonitor()

  app.on('activate', () => {
    triggerOverlay()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (db) db.close()
  if (keymonitorProcess) keymonitorProcess.kill()
})

app.on('browser-window-blur', () => {
  // Keep overlay on top when switching apps
})
