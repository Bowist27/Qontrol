/**
 * StoresTable Component
 * Sortable and searchable table of all 31 stores
 */

import { useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { STORES_DATA } from '../../data/mockData';

interface StoresTableProps {
    onViewInventory: () => void;
}

type SortColumn = 'name' | 'salesToday' | 'inventory' | 'status';

const StoresTable: React.FC<StoresTableProps> = ({ onViewInventory }) => {
    const [sortBy, setSortBy] = useState<SortColumn>('salesToday');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [searchTerm, setSearchTerm] = useState('');

    const handleSort = (column: SortColumn) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const sortedStores = [...STORES_DATA]
        .filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.city.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
            else if (sortBy === 'salesToday') comparison = a.salesToday - b.salesToday;
            else if (sortBy === 'inventory') comparison = a.inventory - b.inventory;
            else if (sortBy === 'status') {
                const order = { offline: 0, warning: 1, online: 2 };
                comparison = order[a.status] - order[b.status];
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

    const SortIndicator = ({ column }: { column: SortColumn }) => {
        if (sortBy !== column) return null;
        return sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Todas las Tiendas</h3>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar tienda..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Table Header */}
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 w-24" onClick={() => handleSort('status')}>
                            <div className="flex items-center gap-1">Estado <SortIndicator column="status" /></div>
                        </th>
                        <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1">Tienda <SortIndicator column="name" /></div>
                        </th>
                        <th className="px-4 py-3 font-medium w-32">Ciudad</th>
                        <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 text-right w-28" onClick={() => handleSort('salesToday')}>
                            <div className="flex items-center gap-1 justify-end">Ventas Hoy <SortIndicator column="salesToday" /></div>
                        </th>
                        <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 text-right w-24" onClick={() => handleSort('inventory')}>
                            <div className="flex items-center gap-1 justify-end">Inventario <SortIndicator column="inventory" /></div>
                        </th>
                        <th className="px-4 py-3 font-medium text-right w-20">Sync</th>
                        <th className="px-4 py-3 font-medium text-right w-24">Acciones</th>
                    </tr>
                </thead>
            </table>

            {/* Table Body with scroll */}
            <div className="overflow-y-auto max-h-[440px]">
                <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                        {sortedStores.map((store) => (
                            <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 w-24">
                                    {store.status === 'online' && (
                                        <span className="flex items-center gap-1.5 text-emerald-600">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                            Online
                                        </span>
                                    )}
                                    {store.status === 'warning' && (
                                        <span className="flex items-center gap-1.5 text-amber-600">
                                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                            Alerta
                                        </span>
                                    )}
                                    {store.status === 'offline' && (
                                        <span className="flex items-center gap-1.5 text-red-600">
                                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                            Offline
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{store.name}</td>
                                <td className="px-4 py-3 text-slate-500 w-32">{store.city}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-800 w-28">
                                    {store.salesToday > 0 ? `$${store.salesToday.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600 w-24">{store.inventory.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right w-20">
                                    {store.status === 'offline' ? (
                                        <span className="text-slate-400">—</span>
                                    ) : store.pendingSync > 0 ? (
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                            {store.pendingSync} pend.
                                        </span>
                                    ) : (
                                        <span className="text-emerald-600 text-xs">✓ Sync</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right w-24">
                                    <button
                                        onClick={onViewInventory}
                                        className="text-xs font-medium hover:underline"
                                        style={{ color: '#06aef0' }}
                                    >
                                        Ver detalle
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
                Mostrando {sortedStores.length} de {STORES_DATA.length} tiendas
            </div>
        </div>
    );
};

export default StoresTable;
