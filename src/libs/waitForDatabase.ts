export const waitForDatabase = async (): Promise<boolean> => {
    return new Promise((resolve) => {
        const checkDatabase = () => {
            if (window.db && typeof window.db.articles?.getAll === 'function') {
                resolve(true);
                return true;
            }
            return false;
        };

        if (checkDatabase()) return;

        const checkInterval = setInterval(() => {
            if (checkDatabase()) {
                clearInterval(checkInterval);
            }
        }, 100);

        setTimeout(() => {
            clearInterval(checkInterval);
            resolve(false);
        }, 30000);
    });
};