/**
 * AuditsView - Orchestrator Component (HU10)
 * Implements Hub & Spoke navigation pattern for audit module
 * 
 * - selectedSession === null → Shows AuditHub (list of stores)
 * - selectedSession !== null → Shows AuditSessionDetail (the perfect UI)
 */

import { Routes, Route } from 'react-router-dom';
import AuditHub from './AuditHub';
import AuditSessionDetail from './AuditSessionDetail';

const AuditsView: React.FC = () => {
    return (
        <Routes>
            <Route index element={<AuditHub />} />
            {/* 'new' must be before ':id' to avoid conflict, though react-router is smart enough usually */}
            <Route path="new" element={<AuditSessionDetail />} />
            <Route path=":id" element={<AuditSessionDetail />} />
        </Routes>
    );
};

export default AuditsView;
