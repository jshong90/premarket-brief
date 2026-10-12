import React from 'react';
import { createRoot } from 'react-dom/client';
import ArchivePage from './pages/ArchivePage';
import './globals.css';

try {
  document.documentElement.dataset.theme = localStorage.getItem('warren-theme') === 'light' ? 'light' : 'dark';
} catch {
  document.documentElement.dataset.theme = 'dark';
}

createRoot(document.getElementById('root')!).render(<ArchivePage/>);
