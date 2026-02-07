import { httpClient } from '../../../services/httpClient';

const API_BASE = 'http://localhost:8085/api'; // Temporary: direct to audit-service




export interface AuditSession {
    id: number;
    store_id: number;
    created_by: string | null;
    status: string;
    reference_date: string | null;
    pdf_url: string | null;
    created_at: string;
    closed_at: string | null;
}

export interface AuditListDTO {
    session: AuditSession;
    store_name: string;
    theoretical_skus: number;
    scanned_skus: number;
}

export interface GetAuditsResponse {
    audits: AuditListDTO[];
}

export const auditApiAdapter = {
    /**
     * Get audits for dashboard (HU10)
     * Calls GET /api/audits
     */
    async getAudits(): Promise<AuditListDTO[]> {
        const data = await httpClient.get<GetAuditsResponse>(`${API_BASE}/audits`);
        return data.audits || [];
    },
};
