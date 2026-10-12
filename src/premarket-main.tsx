import React from 'react';
import {createRoot} from 'react-dom/client';
import DashboardPage from './features/dashboard/DashboardPage';
import './globals.css';
createRoot(document.getElementById('root')!).render(<DashboardPage/>);
