/**
 * AuditsView - Orchestrator Component (HU10)
 * Implements Hub & Spoke navigation pattern for audit module
 * 
 * - selectedSession === null → Shows AuditHub (list of stores)
 * - selectedSession !== null → Shows AuditSessionDetail (the perfect UI)
 */

import { useState, useEffect } from 'react';
import { useAudit } from '../../context/AuditContext';
import AuditHub from './AuditHub';
import AuditSessionDetail from './AuditSessionDetail';

interface SelectedSession {
    id: string;
    storeName: string;
}

const AuditsView: React.FC = () => {
    const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
    const { loadAudits } = useAudit();

    // Load audits when component mounts (HU10 sequence diagram)
    useEffect(() => {
        loadAudits();
    }, [loadAudits]);

    const handleSelectSession = (sessionId: string, storeName: string) => {
        setSelectedSession({ id: sessionId, storeName });
    };

    const handleBack = () => {
        setSelectedSession(null);
        loadAudits(); // Refresh audit list when returning to hub
    };

    // Hub & Spoke Pattern: Show Hub or Detail based on selection
    if (selectedSession) {
        return (
            <AuditSessionDetail
                sessionId={selectedSession.id}
                storeName={selectedSession.storeName}
                onBack={handleBack}
                isNewAudit={selectedSession.id === 'new'}
            />
        );
    }

    return <AuditHub onSelectSession={handleSelectSession} />;
};

export default AuditsView;
