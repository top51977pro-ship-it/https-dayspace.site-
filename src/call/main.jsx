import React from 'react'
import { createRoot } from 'react-dom/client'
import CallApp from './CallApp.jsx'
import '../index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CallApp />
  </React.StrictMode>,
)
