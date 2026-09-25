import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './styles.css';
import './pages.css';
import { App } from './App';
import { UIProvider } from './ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <UIProvider>
        <App />
      </UIProvider>
    </BrowserRouter>
  </StrictMode>,
);
