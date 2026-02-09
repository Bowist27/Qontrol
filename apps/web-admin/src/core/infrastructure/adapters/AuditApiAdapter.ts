import { auditApi, type AuditListDTO } from '../../../services/audit.api';

// Re-export types to maintain compatibility
export type { AuditListDTO };

export const auditApiAdapter = {
    /**
     * Get audits for dashboard (HU10)
     * Calls GET /api/audits via the centralized auditApi service
     */
    async getAudits(): Promise<AuditListDTO[]> {
        return auditApi.getSessions();
    },
};
