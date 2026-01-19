/**
 * DashboardView Component
 * Main dashboard view composing status cards, KPIs, and stores table
 */

import StoreStatusCards from './StoreStatusCards';
import KPICards from './KPICards';
import StoresTable from './StoresTable';

interface DashboardViewProps {
    onViewInventory: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onViewInventory }) => {
    return (
        <div className="space-y-6">
            <StoreStatusCards />
            <KPICards />
            <StoresTable onViewInventory={onViewInventory} />
        </div>
    );
};

export default DashboardView;
