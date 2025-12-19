import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 👇️ 1. Import BrowserRouter
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 👇️ 2. Add the BrowserRouter wrapper here */}
    <BrowserRouter> 
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// --- FIXED: Use Live Backend URL ---
export const API_BASE_URL = "https://capstone1-project.onrender.com/api/all-data";
