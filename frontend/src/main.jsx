import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
// Component from App.jsx; checks route protection and mounts the portal screens.
import App from './App.jsx'

// Mounts the React application and enables StrictMode development checks.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
