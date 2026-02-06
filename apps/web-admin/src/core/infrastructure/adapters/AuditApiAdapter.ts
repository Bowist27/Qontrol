const API_BASE = 'http://localhost:8085/api'; // Temporary: direct to audit-service


// Helper to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

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
        const response = await fetch(`${API_BASE}/audits`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: GetAuditsResponse = await response.json();
        return data.audits || [];
    },
};
