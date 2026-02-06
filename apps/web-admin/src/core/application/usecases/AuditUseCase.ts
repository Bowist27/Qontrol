import { auditApiAdapter, type AuditListDTO } from '../../infrastructure/adapters/AuditApiAdapter';

/**
 * AuditUseCase - Application logic for audit operations (HU10)
 */
export class AuditUseCase {
    /**
     * Get audits for dashboard
     * Applies client-side business logic if needed
     */
    async getAudits(): Promise<AuditListDTO[]> {
        try {
            const audits = await auditApiAdapter.getAudits();
            return audits;
        } catch (error) {
            console.error('Error fetching audits:', error);
            throw new Error('No se pudieron cargar las auditorías');
        }
    }
}

// Singleton instance
export const auditUseCase = new AuditUseCase();
