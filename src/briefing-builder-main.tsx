import React from 'react';
import { createRoot } from 'react-dom/client';
import BriefingBuilder from './BriefingBuilder';
import './globals.css';

try {
  document.documentElement.dataset.theme = localStorage.getItem('warren-theme') === 'light' ? 'light' : 'dark';
} catch {
  document.documentElement.dataset.theme = 'dark';
}

createRoot(document.getElementById('root')!).render(<BriefingBuilder/>);
