import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { auditUseCase } from '../core/application/usecases/AuditUseCase';
import type { AuditListDTO } from '../core/infrastructure/adapters/AuditApiAdapter';

interface AuditContextType {
    audits: AuditListDTO[];
    loading: boolean;
    error: string | null;
    loadAudits: () => Promise<void>;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [audits, setAudits] = useState<AuditListDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAudits = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await auditUseCase.getAudits();
            setAudits(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, []);


    return (
        <AuditContext.Provider value={{ audits, loading, error, loadAudits }}>
            {children}
        </AuditContext.Provider>
    );
};

export const useAudit = () => {
    const context = useContext(AuditContext);
    if (!context) {
        throw new Error('useAudit must be used within AuditProvider');
    }
    return context;
};
