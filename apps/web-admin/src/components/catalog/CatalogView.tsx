/**
 * CatalogView Component - Diff Engine v2
 * Improvements: Checkboxes, Economic Impact, Better Table, Rollback, Sticky Header
 */

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, TrendingUp, TrendingDown, Package, Clock, User, Eye, X, RotateCcw, AlertTriangle } from 'lucide-react';

// Types
interface ImportHistoryItem {
    id: string;
    date: string;
    timeAgo: string;
    user: string;
    fileName: string;
    newProducts: number;
    priceChanges: number;
    totalValue: number;
    previousValue: number;
}

interface DiffDetail {
    sku: string;
    name: string;
    type: 'new' | 'price_up' | 'price_down';
    oldPrice?: number;
    newPrice: number;
    difference: number;
    percentChange?: number;
    selected: boolean;
}

interface DiffResult {
    fileName: string;
    storeName: string;
    detectedStore?: string; // Store detected from file content
    date: string;
    newProducts: number;
    priceUp: number;
    priceDown: number;
    unchanged: number;
    totalValue: number;
    previousValue: number;
    economicImpactUp: number;
    economicImpactDown: number;
    details: DiffDetail[];
}

// Mock data
const IMPORT_HISTORY: ImportHistoryItem[] = [
    { id: 'IMP-004', date: '19 Ene, 10:30 AM', timeAgo: 'Hace 2 horas', user: 'Adrián G.', fileName: 'VALUACIONREP_CELAYA_ENE.pdf', newProducts: 5, priceChanges: 15, totalValue: 3700000, previousValue: 3500000 },
    { id: 'IMP-003', date: '15 Ene, 3:45 PM', timeAgo: 'Hace 4 días', user: 'Adrián G.', fileName: 'VALUACIONREP_QRO.pdf', newProducts: 2, priceChanges: 8, totalValue: 2100000, previousValue: 2050000 },
    { id: 'IMP-002', date: '10 Ene, 9:00 AM', timeAgo: 'Hace 9 días', user: 'María L.', fileName: 'CATALOGO_ENERO_2026.xlsx', newProducts: 0, priceChanges: 45, totalValue: 8500000, previousValue: 8200000 },
];

const createMockDiff = (): DiffResult => ({
    fileName: 'VALUACIONREP_CELAYA.pdf',
    storeName: 'Tienda Salida Celaya',
    detectedStore: 'Celaya', // Matches - no warning
    date: '06-ENE-2026',
    newProducts: 5,
    priceUp: 12,
    priceDown: 3,
    unchanged: 180,
    totalValue: 1895612.50,
    previousValue: 1850000,
    economicImpactUp: 4523.50,
    economicImpactDown: -1250.00,
    details: [
        { sku: '0200300', name: 'PRO 1000 PLUS BLANCO', type: 'price_up', oldPrice: 1400, newPrice: 1423.32, difference: 23.32, percentChange: 1.6, selected: true },
        { sku: '0200310', name: 'PRO 1000 PLUS HUESO', type: 'price_up', oldPrice: 1380, newPrice: 1410.50, difference: 30.50, percentChange: 2.2, selected: true },
        { sku: '0081200', name: 'VINIMEX TOTAL BLANCO', type: 'price_down', oldPrice: 1900, newPrice: 1850, difference: -50, percentChange: -2.6, selected: true },
        { sku: 'NEW-001', name: 'SELLADOR ACRILICO PREMIUM', type: 'new', newPrice: 980, difference: 980, selected: true },
        { sku: 'NEW-002', name: 'BROCHA PROFESIONAL 3"', type: 'new', newPrice: 125, difference: 125, selected: true },
        { sku: 'NEW-003', name: 'CUBETA GENÉRICA', type: 'new', newPrice: 45, difference: 45, selected: true },
    ],
});

const CatalogView: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        processFile();
    };

    const processFile = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setDiffResult(createMockDiff());
        }, 1500);
    };

    const handleToggleItem = (sku: string) => {
        if (!diffResult) return;
        setDiffResult({
            ...diffResult,
            details: diffResult.details.map(d =>
                d.sku === sku ? { ...d, selected: !d.selected } : d
            ),
        });
    };

    const handleToggleAll = () => {
        if (!diffResult) return;
        const allSelected = diffResult.details.every(d => d.selected);
        setDiffResult({
            ...diffResult,
            details: diffResult.details.map(d => ({ ...d, selected: !allSelected })),
        });
    };

    const selectedCount = diffResult?.details.filter(d => d.selected).length ?? 0;

    const handleCommit = () => {
        const selectedItems = diffResult?.details.filter(d => d.selected) || [];
        alert(`✅ ${selectedItems.length} cambios aplicados exitosamente al catálogo`);
        setDiffResult(null);
    };

    const handleRevert = (id: string) => {
        if (confirm(`¿Deseas revertir la carga "${id}"? Esto restaurará los precios anteriores.`)) {
            alert(`⏪ Carga ${id} revertida exitosamente`);
        }
    };

    return (
        <div className="flex gap-6 h-[calc(100vh-140px)]">
            {/* LEFT: Timeline (30%) */}
            <div className="w-[30%] bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock size={18} style={{ color: '#06aef0' }} />
                        Historial de Importaciones
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {IMPORT_HISTORY.map((item, index) => (
                        <div
                            key={item.id}
                            className="relative"
                            onMouseEnter={() => setHoveredHistoryId(item.id)}
                            onMouseLeave={() => setHoveredHistoryId(null)}
                        >
                            {index < IMPORT_HISTORY.length - 1 && (
                                <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-slate-200"></div>
                            )}

                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center flex-shrink-0 z-10">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#06aef0' }}></div>
                                </div>

                                <div className="flex-1 bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors cursor-pointer relative">
                                    {/* Rollback Button on Hover */}
                                    {hoveredHistoryId === item.id && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRevert(item.id); }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                            title="Revertir esta carga"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    )}

                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-slate-500">{item.timeAgo}</span>
                                        <span className="text-xs text-slate-400">{item.date}</span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-2">
                                        <User size={12} className="text-slate-400" />
                                        <span className="text-sm font-medium text-slate-700">{item.user}</span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3">
                                        <FileText size={12} className="text-slate-400" />
                                        <span className="text-xs text-slate-500 truncate">{item.fileName}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {item.newProducts > 0 && (
                                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">+{item.newProducts} nuevos</span>
                                        )}
                                        {item.priceChanges > 0 && (
                                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{item.priceChanges} precios</span>
                                        )}
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Valor Total:</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-bold text-slate-800">${(item.totalValue / 1000000).toFixed(1)}M</span>
                                            {item.totalValue > item.previousValue ? (
                                                <TrendingUp size={14} className="text-emerald-500" />
                                            ) : (
                                                <TrendingDown size={14} className="text-red-500" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Action Zone (70%) */}
            <div className="flex-1 flex flex-col">
                {!diffResult ? (
                    <div
                        className={`flex-1 bg-white rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={processFile}
                    >
                        {isProcessing ? (
                            <div className="text-center">
                                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-lg font-medium text-slate-700">Analizando archivo...</p>
                                <p className="text-sm text-slate-500">Detectando productos y cambios de precio</p>
                            </div>
                        ) : (
                            <>
                                <Upload size={64} className={isDragging ? 'text-blue-500' : 'text-slate-400'} />
                                <h3 className="text-xl font-bold text-slate-800 mt-4">Arrastra aquí el Reporte de Valuación</h3>
                                <p className="text-slate-500 mt-2 text-center max-w-md">
                                    El sistema detectará automáticamente nuevos productos y cambios de costos
                                </p>
                                <p className="text-xs text-slate-400 mt-4">Formatos: PDF, Excel (.xlsx, .xls)</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Reporte Analizado</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-slate-600">{diffResult.storeName}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-500">📅 {diffResult.date}</span>
                                </div>
                            </div>
                            <button onClick={() => setDiffResult(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Impact Cards with Economic Values */}
                        <div className="p-6 grid grid-cols-4 gap-4">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                <Package size={24} className="mx-auto text-emerald-600 mb-2" />
                                <p className="text-3xl font-bold text-emerald-700">{diffResult.newProducts}</p>
                                <p className="text-sm text-emerald-600">Productos Nuevos</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                <TrendingUp size={24} className="mx-auto text-blue-600 mb-2" />
                                <p className="text-3xl font-bold text-blue-700">{diffResult.priceUp}</p>
                                <p className="text-sm text-blue-600">Subieron Precio</p>
                                <p className="text-xs text-blue-500 mt-1 font-medium">+${diffResult.economicImpactUp.toLocaleString()}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                <TrendingDown size={24} className="mx-auto text-amber-600 mb-2" />
                                <p className="text-3xl font-bold text-amber-700">{diffResult.priceDown}</p>
                                <p className="text-sm text-amber-600">Bajaron Precio</p>
                                <p className="text-xs text-amber-500 mt-1 font-medium">${diffResult.economicImpactDown.toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                <CheckCircle2 size={24} className="mx-auto text-slate-500 mb-2" />
                                <p className="text-3xl font-bold text-slate-700">{diffResult.unchanged}</p>
                                <p className="text-sm text-slate-500">Sin Cambios</p>
                            </div>
                        </div>

                        {/* Total Value */}
                        <div className="px-6 pb-4">
                            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 flex items-center justify-between text-white">
                                <div>
                                    <p className="text-sm text-slate-300">Valor Total del Inventario</p>
                                    <p className="text-2xl font-bold">${diffResult.totalValue.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400">Anterior: ${diffResult.previousValue.toLocaleString()}</p>
                                    <p className={`text-lg font-bold ${diffResult.totalValue > diffResult.previousValue ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {diffResult.totalValue > diffResult.previousValue ? '↑' : '↓'}
                                        {' '}{Math.abs(((diffResult.totalValue - diffResult.previousValue) / diffResult.previousValue) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Details Table with Checkboxes */}
                        {showDetails && (
                            <div className="flex-1 overflow-hidden px-6 pb-4 flex flex-col min-h-0">
                                <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col flex-1">
                                    {/* Sticky Header */}
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={diffResult.details.every(d => d.selected)}
                                                        onChange={handleToggleAll}
                                                        className="rounded border-slate-300"
                                                    />
                                                </th>
                                                <th className="px-4 py-3 text-left font-medium w-24">SKU</th>
                                                <th className="px-4 py-3 text-left font-medium">Producto</th>
                                                <th className="px-4 py-3 text-left font-medium w-24">Cambio</th>
                                                <th className="px-4 py-3 text-right font-medium w-28">Anterior</th>
                                                <th className="px-4 py-3 text-right font-medium w-28">Nuevo</th>
                                                <th className="px-4 py-3 text-right font-medium w-28">Diferencia</th>
                                            </tr>
                                        </thead>
                                    </table>
                                    {/* Scrollable Body */}
                                    <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <tbody className="divide-y divide-slate-100">
                                                {diffResult.details.map((item) => (
                                                    <tr key={item.sku} className={`hover:bg-slate-50 ${!item.selected ? 'opacity-50' : ''}`}>
                                                        <td className="px-4 py-3 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.selected}
                                                                onChange={() => handleToggleItem(item.sku)}
                                                                className="rounded border-slate-300"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs w-24">{item.sku}</td>
                                                        <td className="px-4 py-3 text-slate-700">{item.name}</td>
                                                        <td className="px-4 py-3 w-24">
                                                            {item.type === 'new' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Nuevo</span>}
                                                            {item.type === 'price_up' && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">↑ Subió</span>}
                                                            {item.type === 'price_down' && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">↓ Bajó</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-400 line-through w-28">
                                                            {item.oldPrice ? `$${item.oldPrice.toLocaleString()}` : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-800 w-28">
                                                            ${item.newPrice.toLocaleString()}
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-bold w-28 ${item.difference > 0 ? 'text-emerald-600' : item.difference < 0 ? 'text-red-600' : 'text-slate-400'
                                                            }`}>
                                                            {item.difference > 0 ? '+' : ''}{item.difference !== 0 ? `$${item.difference.toFixed(2)}` : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <Eye size={16} />
                                {showDetails ? 'Ocultar Detalles' : 'Ver Detalles'}
                            </button>
                            <button
                                onClick={handleCommit}
                                disabled={selectedCount === 0}
                                className="px-8 py-3 rounded-xl text-white font-bold text-lg hover:opacity-90 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#06aef0' }}
                            >
                                <CheckCircle2 size={20} />
                                {selectedCount === diffResult.details.length
                                    ? 'VALIDAR Y ACTUALIZAR TODO'
                                    : `VALIDAR ${selectedCount} ITEMS`
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CatalogView;
