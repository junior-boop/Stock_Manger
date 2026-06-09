import './index.css'
import "../output.css"
import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app';
import { DatabaseProvider } from './databaseProvider';
import { waitForDatabase } from './libs/waitForDatabase';
import { SvgSpinners180RingWithBg } from './libs/icons';

const CheckData = () => {
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        waitForDatabase().then((ready) => {
            setDbReady(ready);
        });
    }, []);

    if (!dbReady) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-36px)] bg-gray-50">
                <div className="text-center">
                    <SvgSpinners180RingWithBg className="h-12 w-12 mx-auto mb-4 text-blue-600" />
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
