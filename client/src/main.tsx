import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#FAF7F2',
            color: '#2C2C2C',
            border: '1px solid #E8D5A3',
            borderRadius: '0.75rem',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: { primary: '#C9A84C', secondary: '#FAF7F2' },
          },
          error: {
            iconTheme: { primary: '#4A1942', secondary: '#FAF7F2' },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>
);
