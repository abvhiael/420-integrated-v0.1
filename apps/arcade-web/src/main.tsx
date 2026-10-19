import React from 'react';
import {createRoot} from 'react-dom/client';
import {Launcher} from './App';
import './style.css';
const root=document.getElementById('root');
if(!root)throw new Error('Missing application root');
createRoot(root).render(<React.StrictMode><Launcher/></React.StrictMode>);
