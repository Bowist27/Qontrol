/**
 * AdminDashboard Page
 * Main orchestrator combining all components
 */

import { useState, useEffect } from 'react';
import type { ViewType, SystemHealth } from '../types';

// Layout components
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import SystemStatusModal from '../components/layout/SystemStatusModal';

// View components
import DashboardView from '../components/dashboard/DashboardView';
import InventoryView from '../components/inventory/InventoryView';
import AuditsView from '../components/audits/AuditsView';
import CatalogView from '../components/catalog/CatalogView';
import UsersView from '../components/users/UsersView';

export default function AdminDashboard() {
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 200, online: true });
    const [showSystemStatus, setShowSystemStatus] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Simulate system health check
    useEffect(() => {
        const interval = setInterval(() => {
            setSystemHealth({ status: 200, online: true });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        alert("Cerrando sesión y limpiando tokens...");
        // In real app: clear tokens, redirect to login
    };

    const handleViewInventory = () => {
        setCurrentView('inventory_detail');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans">
            {/* Sidebar */}
            <Sidebar
                currentView={currentView}
                onViewChange={setCurrentView}
                systemHealth={systemHealth}
                onShowSystemStatus={() => setShowSystemStatus(true)}
                onLogout={handleLogout}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* System Status Modal */}
            <SystemStatusModal
                isOpen={showSystemStatus}
                onClose={() => setShowSystemStatus(false)}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <Topbar currentView={currentView} onLogout={handleLogout} />

                <div className="p-8 overflow-y-auto h-[calc(100vh-64px)]">
                    {currentView === 'dashboard' && (
                        <DashboardView onViewInventory={handleViewInventory} />
                    )}
                    {currentView === 'inventory_detail' && <InventoryView />}
                    {currentView === 'audits' && <AuditsView />}
                    {currentView === 'catalog' && <CatalogView />}
                    {currentView === 'users' && <UsersView />}
                </div>
            </main>
        </div>
    );
}
