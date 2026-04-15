import './index.css'
import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app';

const CheckData = () => {

    return <App />
}


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <CheckData />
    </StrictMode>,
)
