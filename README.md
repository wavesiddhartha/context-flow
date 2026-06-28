# ContextFlow ♾️

An elegant, AI-powered desktop debugging companion for macOS, Windows, and Linux. Built with a premium, editorial cream-and-ink aesthetic, ContextFlow sits silently in your system and activates on-demand to analyze your screen captures, answer coding queries, and resolve bugs.

---

## Key Features

- **Double-Press Hotkey Activation:** Double-press the `Option` (macOS) or `Alt` (Windows/Linux) key to instantly invoke the floating HUD indicator.
- **Apple-Inspired Siri HUD Indicator:** An ultra-minimalist, floating outline capsule anchored at the bottom-center of the screen. Responds dynamically to system inputs and fades out silently.
- **Interactive Screenshot Capture:** Captures active windows automatically on hover & click-through.
- **Editorial Cream-and-Ink Aesthetic:** Built on a custom color palette of baked-parchment cream (`#EDEBE3`) and deep near-black ink (`#0D0D0B`).
- **High-Contrast Pure Black Code Blocks:** Syntax-highlighted code cards rendered on `#000000` panels featuring automatic copy buttons and uppercase monospace headers.
- **Dual NIM Model Support:** Supports vision-based screenshot analysis (using DeepSeek V4) and coding models (using Kimi K2.6) served via high-performance NVIDIA APIs.

---

## Technical Stack

- **Electron** — Desktop container shell
- **React + Vite** — High-performance frontend UI rendering
- **SQLite (better-sqlite3)** — Local session history storage
- **NVIDIA NIM APIs** — Serves DeepSeek V4 (vision) and Kimi K2.6 (chat) LLMs

---

## Setup & Installation

Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
# Clone the repository
git clone https://github.com/wavesiddhartha/context-flow.git
cd context-flow

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the root of the project and add your NVIDIA API key:

```env
NVIDIA_API_KEY=your_nvidia_api_key_here
```

---

## Running the Project

To launch the project in development mode:

```bash
npm run dev
```

This starts the Vite build runner and launches the Electron application container concurrently.

---

## Key Bindings

| Action | Shortcut |
|---|---|
| **Invoke HUD (Double Press)** | `Option` (macOS) or `Alt` (Windows/Linux) |
| **Invoke HUD (Standard)** | `⌘ + Shift + Space` (macOS) / `Ctrl + Shift + Space` |
| **Submit Question** | `Enter` |
| **New Line** | `Shift + Enter` |
| **Close Overlay** | `Escape` or Click `X` |

---

## Architecture Overview

```
contextflow/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main — hotkeys, screenshots, DB, IPC
│   │   └── preload.js     # Secure contextBridge interface
│   └── renderer/
│       ├── main.jsx        # React entry point — routes App vs Overlay
│       ├── App.jsx         # Main workspace dashboard window
│       ├── pages/
│       │   ├── Overlay.jsx     # Floating HUD overlay conversation view
│       │   ├── Welcome.jsx     # Welcome onboarding page
│       │   └── SessionView.jsx # Chat container for past sessions
│       ├── components/
│       │   ├── Sidebar.jsx       # Left sidebar listing past sessions
│       │   └── MessageBubble.jsx # Chat bubble formatting (serif text, black code cards)
│       ├── services/
│       │   └── nvidia.js    # NVIDIA APIs client integration
│       └── styles/          # Modular CSS stylesheet components
├── index.html
├── vite.config.js
└── package.json
```

---

## Data Directories

All session captures, database logs, and cropped screenshots are saved locally:
- **macOS:** `~/Library/Application Support/contextflow/`
- **Windows:** `%APPDATA%/contextflow/`
- **Linux:** `~/.config/contextflow/`
