import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.scss' // Import global SCSS
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
