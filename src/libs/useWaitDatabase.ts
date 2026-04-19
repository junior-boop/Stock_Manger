import { useDatabase } from '../databaseProvider';

export const useWaitDatabase = () => {
    const { isLoading, error } = useDatabase();

    const waitForDatabase = async (): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!isLoading && !error) {
                resolve(true);
                return;
            }

            const checkInterval = setInterval(() => {
                if (!isLoading && !error) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(false);
            }, 30000);
        });
    };

    return {
        isLoading,
        error,
        waitForDatabase
    };
};