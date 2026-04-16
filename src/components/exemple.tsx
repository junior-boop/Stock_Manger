import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
    useMemo
} from 'react';
import { Groups, Notes, usersession } from '../../lib/database/db';
import { QueryBuilder } from './QueryBuilder';
import { AiHistoryType } from '@/src/lib/database';

// Définition d'un type pour les erreurs de base de données
type DatabaseError = {
    message: string;
    code: string;
    details?: unknown;
};

// Interface améliorée avec gestion d'erreurs
interface DatabaseContextType {
    notesQuery: QueryBuilder<Notes> | null;
    groupedQuery: QueryBuilder<Groups> | null;
    session: usersession | null;
    isLoading: boolean;
    error: DatabaseError | null;
    addNote: (noteData: Partial<Notes>) => Promise<Notes | undefined>;
    updateNote: (noteData: Partial<Notes>) => Promise<void>;
    deleteNote: (id: string) => Promise<void>;
    toggleNotePinned: (note: Notes) => Promise<void>;
    toggleNoteArchived: (note: Notes) => Promise<void>;
    addNotetoGroup: (data: { id: string, grouped: string }) => Promise<Notes>;
    addGroup: (data: Groups) => Promise<Groups>;
    updatedGroup: (data: Groups) => Promise<Groups>;
    deletedGroup: (id: string) => Boolean | ['impossible'];
    clearError: () => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
    const [notesQuery, setNotes] = useState<QueryBuilder<Notes> | null>(null);
    const [groupedQuery, setGrouped] = useState<QueryBuilder<Groups> | null>(null);

    const [session, setSession] = useState<usersession | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<DatabaseError | null>(null);


    const handleError = useCallback((error: unknown, operation: string) => {
        const dbError: DatabaseError = {
            message: `Error during ${operation}`,
            code: 'DB_ERROR',
            details: error
        };
        setError(dbError);
        console.error(`Database error during ${operation}:`, error);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Modifier loadInitialData
    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        clearError();
        try {
            const [notesResult, sessionResult, groupesResult] = await Promise.all([
                window.api.db.getnotes(),
                window.api.db.getsession(),
                window.api.db.getgroupes()
            ]);
            const notesArray = new QueryBuilder<Notes>(notesResult || []);
            const groupArray = new QueryBuilder<Groups>(groupesResult || [])
            setNotes(notesArray);
            setGrouped(groupArray)
            setSession(sessionResult || null);
        } catch (error) {
            handleError(error, 'initial data loading');
        } finally {
            setIsLoading(false);
        }
    }, [handleError, clearError]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);



    const addNote = useCallback(async (noteData: Notes) => {
        clearError();
        try {
            const result = await window.api.db.setnote(noteData);
            loadInitialData();

            return result;
        } catch (error) {
            handleError(error, 'adding note');
        }
    }, [loadInitialData]);

    const updateNote = useCallback(async (noteData: { id: string, body: string, version: number, html: string }) => {
        clearError();
        try {
            console.log('Updating note with data:', noteData)
            await window.api.db.modifynoteid(noteData);
            loadInitialData();
        } catch (error) {
            handleError(error, 'updating note');
        }
    }, [handleError, clearError, loadInitialData]);

    // Modifier deleteNote
    const deleteNote = useCallback(async (id: string) => {
        clearError();
        try {
            await window.api.db.deletenote(id);
            loadInitialData();
        } catch (error) {
            handleError(error, 'deleting note');
        }
    }, [handleError, clearError, loadInitialData]);

    // Modifier toggleNotePinned
    const toggleNotePinned = useCallback(async (note: Notes) => {
        console.log("Toggling pin for note:", note);
        try {
            const updatedNote = { ...note, pinned: note.pinned };
            await window.api.db.setnotespinned(updatedNote);
            loadInitialData();
        } catch (error) {
            handleError(error, 'toggling note pin status');
        }
    }, [loadInitialData]);

    // Modifier toggleNoteArchived
    const toggleNoteArchived = useCallback(async (note: Notes) => {
        clearError();
        try {
            const updatedNote = { ...note, archived: note.archived };
            await window.api.db.setnotesarchived(updatedNote);
            loadInitialData();
        } catch (error) {
            handleError(error, 'toggling note archive status');
        }
    }, [handleError, clearError, loadInitialData]);

    const addNotetoGroup = useCallback(async (data: Groups) => {
        clearError();
        try {
            const result = await window.api.db.addnotetogroup(data);
            loadInitialData();

            return result;
        } catch (error) {
            handleError(error, 'adding note');
        }
    }, [loadInitialData])

    const addGroup = useCallback(async (data: Groups) => {
        clearError();
        try {
            const result = await window.api.db.setgroup(data);
            loadInitialData();

            return result;
        } catch (error) {
            handleError(error, 'adding note');
        }
    }, [loadInitialData])

    const updatedGroup = useCallback(async (data: { id: string, name: string }) => {
        clearError();
        try {
            const result = await window.api.db.modifiedgroup(data);
            loadInitialData();
            return result;
        } catch (error) {
            handleError(error, 'adding note');
        }
    }, [loadInitialData])

    const deletedGroup = useCallback(async (id: string) => {
        clearError();
        try {
            const result = await window.api.db.deletegroup(id);
            loadInitialData();
            return result;
        } catch (error) {
            handleError(error, 'adding note');
        }
    }, [loadInitialData])

    // Optimisation avec useMemo pour la valeur du contexte
    const contextValue = useMemo(() => ({
        notesQuery,
        groupedQuery,
        session,
        isLoading,
        error,
        addNote,
        updateNote,
        deleteNote,
        toggleNotePinned,
        toggleNoteArchived,
        addNotetoGroup,
        addGroup,
        updatedGroup,
        deletedGroup,
        clearError
    }), [
        notesQuery,
        groupedQuery,
        session,
        isLoading,
        error,
        addNote,
        updateNote,
        deleteNote,
        toggleNotePinned,
        toggleNoteArchived,
        addNotetoGroup,
        addGroup,
        updatedGroup,
        deletedGroup,
        clearError
    ]);

    return (
        <DatabaseContext.Provider value={contextValue}>
            {children}
        </DatabaseContext.Provider>
    );
};

export const useDatabase = () => {
    const context = useContext(DatabaseContext);
    if (context === undefined) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return context;
};