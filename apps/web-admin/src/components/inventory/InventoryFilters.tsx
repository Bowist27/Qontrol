/**
 * InventoryFilters Component
 * Sidebar filters for inventory view (faceted search)
 */

import { Filter } from 'lucide-react';
import type { ProductFamily, Presentation, StockStatus } from '../../types';

interface InventoryFiltersProps {
    familyFilter: ProductFamily | 'all';
    presentationFilter: Presentation | 'all';
    stockFilter: StockStatus | 'all';
    showStockFilter: boolean;
    onFamilyChange: (family: ProductFamily | 'all') => void;
    onPresentationChange: (presentation: Presentation | 'all') => void;
    onStockChange: (status: StockStatus | 'all') => void;
    onClear: () => void;
}

const FAMILIES: (ProductFamily | 'all')[] = ['all', 'Vinílicas', 'Esmaltes', 'Impermeabilizantes', 'Accesorios', 'Selladores'];
const PRESENTATIONS: (Presentation | 'all')[] = ['all', '1L', '4L', '19L', 'Tambor', 'Pieza'];

const InventoryFilters: React.FC<InventoryFiltersProps> = ({
    familyFilter,
    presentationFilter,
    stockFilter,
    showStockFilter,
    onFamilyChange,
    onPresentationChange,
    onStockChange,
    onClear,
}) => {
    return (
        <div className="w-64 bg-white rounded-xl border border-slate-200 p-4 flex-shrink-0 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
                <Filter size={18} className="text-slate-500" />
                <h3 className="font-bold text-slate-800">Filtros</h3>
            </div>

            {/* Family Filter */}
            <div className="mb-5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Familia</label>
                <div className="space-y-1">
                    {FAMILIES.map((fam) => (
                        <button
                            key={fam}
                            onClick={() => onFamilyChange(fam)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${familyFilter === fam ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            style={familyFilter === fam ? { backgroundColor: '#06aef0' } : {}}
                        >
                            {fam === 'all' ? 'Todas las familias' : fam}
                        </button>
                    ))}
                </div>
            </div>

            {/* Presentation Filter */}
            <div className="mb-5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Presentación</label>
                <div className="space-y-1">
                    {PRESENTATIONS.map((pres) => (
                        <button
                            key={pres}
                            onClick={() => onPresentationChange(pres)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${presentationFilter === pres ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            style={presentationFilter === pres ? { backgroundColor: '#06aef0' } : {}}
                        >
                            {pres === 'all' ? 'Todas' : pres}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stock Status Filter (only when store selected) */}
            {showStockFilter && (
                <div className="mb-5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Estado Stock</label>
                    <div className="space-y-1">
                        <button
                            onClick={() => onStockChange('all')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${stockFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => onStockChange('critical')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${stockFilter === 'critical' ? 'bg-red-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span> Agotado / Crítico
                        </button>
                        <button
                            onClick={() => onStockChange('low')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${stockFilter === 'low' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span> Stock Bajo
                        </button>
                        <button
                            onClick={() => onStockChange('ok')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${stockFilter === 'ok' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Saludable
                        </button>
                        <button
                            onClick={() => onStockChange('overstock')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${stockFilter === 'overstock' ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Sobre-stock
                        </button>
                    </div>
                </div>
            )}

            {/* Clear Filters */}
            <button
                onClick={onClear}
                className="w-full mt-4 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
                Limpiar filtros
            </button>
        </div>
    );
};

export default InventoryFilters;
