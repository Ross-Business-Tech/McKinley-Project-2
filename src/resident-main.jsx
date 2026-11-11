import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ResidentApp from './resident/ResidentApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ResidentApp />
  </StrictMode>,
)
