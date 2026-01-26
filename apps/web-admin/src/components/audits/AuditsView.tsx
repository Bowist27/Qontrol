/**
 * AuditsView - Orchestrator Component
 * Implements Hub & Spoke navigation pattern for audit module
 * 
 * - selectedSession === null → Shows AuditHub (list of stores)
 * - selectedSession !== null → Shows AuditSessionDetail (the perfect UI)
 */

import { useState } from 'react';
import AuditHub from './AuditHub';
import AuditSessionDetail from './AuditSessionDetail';

interface SelectedSession {
    id: string;
    storeName: string;
}

const AuditsView: React.FC = () => {
    const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);

    const handleSelectSession = (sessionId: string, storeName: string) => {
        setSelectedSession({ id: sessionId, storeName });
    };

    const handleBack = () => {
        setSelectedSession(null);
    };

    // Hub & Spoke Pattern: Show Hub or Detail based on selection
    if (selectedSession) {
        return (
            <AuditSessionDetail
                sessionId={selectedSession.id}
                storeName={selectedSession.storeName}
                onBack={handleBack}
            />
        );
    }

    return <AuditHub onSelectSession={handleSelectSession} />;
};

export default AuditsView;
