import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './ui/App';
import '@fontsource-variable/noto-sans-kr';
import './ui/style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
