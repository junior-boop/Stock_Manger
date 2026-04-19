import './index.css'
import "../output.css"
import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app';
import { DatabaseProvider } from './databaseProvider';
import { waitForDatabase } from './libs/waitForDatabase';

const CheckData = () => {
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        waitForDatabase().then((ready) => {
            setDbReady(ready);
        });
    }, []);

    if (!dbReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-inter-regular">Chargement de la base de données...</p>
                </div>
            </div>
        );
    }

    return <App />
}


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <DatabaseProvider>
            <CheckData />
        </DatabaseProvider>
    </StrictMode>,
)
