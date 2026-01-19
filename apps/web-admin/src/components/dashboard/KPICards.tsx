/**
 * KPICards Component
 * Global KPI cards: Sales, Inventory, Active Stores, Pending Sync
 */

import { DollarSign, Package, Store, RefreshCw, TrendingUp } from 'lucide-react';
import { STORES_DATA } from '../../data/mockData';

const KPICards: React.FC = () => {
    const totalSales = STORES_DATA.reduce((sum, s) => sum + s.salesToday, 0);
    const totalInventory = STORES_DATA.reduce((sum, s) => sum + s.inventory, 0);
    const onlineStores = STORES_DATA.filter(s => s.status === 'online').length;
    const totalPendingSync = STORES_DATA.filter(s => s.status !== 'offline').reduce((sum, s) => sum + s.pendingSync, 0);

    const kpis = [
        {
            label: 'Venta Total Hoy',
            value: `$${totalSales.toLocaleString()}`,
            icon: DollarSign,
            subtitle: <span className="text-xs text-emerald-600 flex items-center gap-1"><TrendingUp size={12} /> +12.5% vs ayer</span>,
        },
        {
            label: 'Inventario Total',
            value: totalInventory.toLocaleString(),
            icon: Package,
            subtitle: <span className="text-xs text-slate-500">unidades en sistema</span>,
        },
        {
            label: 'Tiendas Activas',
            value: `${onlineStores}/${STORES_DATA.length}`,
            icon: Store,
            subtitle: <span className="text-xs text-slate-500">sucursales operando</span>,
        },
        {
            label: 'Pendiente Sincronizar',
            value: totalPendingSync,
            icon: RefreshCw,
            iconClassName: totalPendingSync > 0 ? 'text-amber-500' : 'text-slate-400',
            valueClassName: totalPendingSync > 0 ? 'text-amber-600' : 'text-slate-800',
            subtitle: <span className="text-xs text-slate-500">registros pendientes</span>,
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-4">
            {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                    <div key={kpi.label} className="bg-white p-5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-slate-500">{kpi.label}</p>
                            <Icon size={18} className={kpi.iconClassName} style={!kpi.iconClassName ? { color: '#06aef0' } : {}} />
                        </div>
                        <p className={`text-2xl font-bold ${kpi.valueClassName || 'text-slate-800'}`}>{kpi.value}</p>
                        <div className="mt-1">{kpi.subtitle}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default KPICards;
