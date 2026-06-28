import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Overlay from './pages/Overlay'
import './styles/global.css'

const isOverlay = window.location.hash === '#overlay'

const root = createRoot(document.getElementById('root'))
root.render(isOverlay ? <Overlay /> : <App />)
