/**
 * AuditsView Component - HU-11: Centro de Comando de Auditoría
 * 3 Sections: Header (sticky), Split Cards (Teórico + Físico), Reconciliation Table
 */

import { useState, useEffect } from 'react';
import {
    ChevronDown, FileText, Upload, Wifi, WifiOff, Clock, Users, AlertTriangle,
    CheckCircle2, RefreshCw, Eye, Search, FileSpreadsheet,
    Activity, AlertCircle, Package, BarChart3, History
} from 'lucide-react';
import { STORES_DATA } from '../../data/mockData';

// Types
type AuditStatus = 'not_started' | 'partial' | 'in_progress' | 'reconciled';

interface TheoreticalData {
    status: 'empty' | 'loaded' | 'error';
    fileName?: string;
    uploadDate?: string;
    totalItems: number;
    totalUnits: number;
    totalValue: number;
    errorMessage?: string;
}

interface PhysicalData {
    status: 'disconnected' | 'active';
    scannedItems: number;
    activeUsers: string[];
    lastSync?: string;
}

interface DiffItem {
    sku: string;
    name: string;
    unitCost: number;
    theoretical: number;
    physical: number;
    difference: number;
    impact: number;
    justification?: string;
}

// Mock Data
const MOCK_THEORETICAL: TheoreticalData = {
    status: 'loaded',
    fileName: 'valuacion_enero_2026.pdf',
    uploadDate: '24 Ene 2026, 10:30 AM',
    totalItems: 1250,
    totalUnits: 45300,
    totalValue: 450000,
};

const MOCK_PHYSICAL: PhysicalData = {
    status: 'active',
    scannedItems: 840,
    activeUsers: ['Juan M.', 'Pedro G.'],
    lastSync: 'Hace 5 segundos',
};

const MOCK_DIFF_ITEMS: DiffItem[] = [
    { sku: '0200300', name: 'PRO 1000 PLUS BLANCO 19L', unitCost: 1423.32, theoretical: 25, physical: 23, difference: -2, impact: -2846.64 },
    { sku: '0200310', name: 'PRO 1000 PLUS HUESO 19L', unitCost: 1410.50, theoretical: 18, physical: 18, difference: 0, impact: 0 },
    { sku: '0081200', name: 'VINIMEX TOTAL BLANCO 19L', unitCost: 1850, theoretical: 40, physical: 35, difference: -5, impact: -9250 },
    { sku: 'VIN-003', name: 'VINIMEX TOTAL ROJO 4L', unitCost: 520, theoretical: 30, physical: 32, difference: 2, impact: 1040 },
    { sku: 'ESM-001', name: 'ESMALTE COMEX NEGRO 1L', unitCost: 285, theoretical: 50, physical: 48, difference: -2, impact: -570 },
    { sku: 'ESM-002', name: 'ESMALTE COMEX BLANCO MATE 4L', unitCost: 680, theoretical: 35, physical: 35, difference: 0, impact: 0 },
    { sku: 'IMP-001', name: 'IMPERMEABILIZANTE 5 AÑOS TERRACOTA 19L', unitCost: 2450, theoretical: 22, physical: 20, difference: -2, impact: -4900 },
    { sku: 'IMP-002', name: 'IMPERMEABILIZANTE 10 AÑOS BLANCO 19L', unitCost: 3200, theoretical: 15, physical: 15, difference: 0, impact: 0 },
    { sku: 'ACC-001', name: 'BROCHA PROFESIONAL 2"', unitCost: 85, theoretical: 120, physical: 118, difference: -2, impact: -170 },
    { sku: 'ACC-002', name: 'RODILLO ANTIGOTA 9"', unitCost: 125, theoretical: 80, physical: 82, difference: 2, impact: 250 },
    { sku: 'SEL-001', name: 'SELLADOR 5X1 TRANSPARENTE 19L', unitCost: 1280, theoretical: 28, physical: 25, difference: -3, impact: -3840 },
    { sku: 'VIN-004', name: 'VINIMEX ANTIBACTERIAL BLANCO 4L', unitCost: 620, theoretical: 45, physical: 45, difference: 0, impact: 0 },
    { sku: 'VIN-005', name: 'VINIMEX ANTIBACTERIAL AZUL CIELO 4L', unitCost: 650, theoretical: 25, physical: 23, difference: -2, impact: -1300 },
    { sku: 'PRE-001', name: 'PRIMER ANTICORROSIVO GRIS 4L', unitCost: 480, theoretical: 32, physical: 32, difference: 0, impact: 0 },
    { sku: 'PRE-002', name: 'PRIMER SELLADOR BLANCO 19L', unitCost: 1150, theoretical: 18, physical: 16, difference: -2, impact: -2300 },
    { sku: 'NEW-SCAN', name: 'PRODUCTO NO LISTADO EN PDF', unitCost: 0, theoretical: 0, physical: 8, difference: 8, impact: 0 },
    { sku: 'NEW-002', name: 'ARTICULO DESCONOCIDO ESCANEADO', unitCost: 0, theoretical: 0, physical: 5, difference: 5, impact: 0 },
];

const AuditsView: React.FC = () => {
    const [selectedStoreId, setSelectedStoreId] = useState<number>(1);
    const [theoretical, setTheoretical] = useState<TheoreticalData>({ status: 'empty', totalItems: 0, totalUnits: 0, totalValue: 0 });
    const [physical, setPhysical] = useState<PhysicalData>({ status: 'disconnected', scannedItems: 0, activeUsers: [] });
    const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
    const [filter, setFilter] = useState<'all' | 'differences' | 'missing'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);

    // Calculate audit status
    const getAuditStatus = (): AuditStatus => {
        if (theoretical.status === 'empty' && physical.status === 'disconnected') return 'not_started';
        if (theoretical.status === 'loaded' && physical.status === 'disconnected') return 'partial';
        if (theoretical.status === 'empty' && physical.status === 'active') return 'partial';
        if (theoretical.status === 'loaded' && physical.status === 'active') return 'in_progress';
        return 'not_started';
    };

    const auditStatus = getAuditStatus();

    // Simulate live updates
    useEffect(() => {
        const interval = setInterval(() => {
            if (physical.status === 'active') {
                setPhysical(prev => ({
                    ...prev,
                    lastSync: 'Hace ' + Math.floor(Math.random() * 10 + 1) + ' segundos',
                }));
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [physical.status]);

    // Handle PDF drop
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        simulateUpload();
    };

    const simulateUpload = () => {
        setIsUploading(true);
        setTimeout(() => {
            setIsUploading(false);
            setTheoretical(MOCK_THEORETICAL);
            setPhysical(MOCK_PHYSICAL); // Simulate that physical data also exists
            setDiffItems(MOCK_DIFF_ITEMS);
        }, 2000);
    };

    const handleReplaceFile = () => {
        if (confirm('¿Deseas reemplazar el archivo actual? Esto recalculará todas las diferencias.')) {
            setTheoretical({ status: 'empty', totalItems: 0, totalUnits: 0, totalValue: 0 });
            setDiffItems([]);
        }
    };

    // Filter diff items
    const filteredItems = diffItems.filter(item => {
        const matchesSearch = item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (filter === 'differences') return matchesSearch && item.difference !== 0;
        if (filter === 'missing') return matchesSearch && item.difference < 0;
        return matchesSearch;
    });

    // Stats for alerts
    const highValueDiffs = diffItems.filter(i => i.impact < -5000).length;
    const unlistedProducts = diffItems.filter(i => i.theoretical === 0 && i.physical > 0).length;
    const totalNegativeImpact = diffItems.filter(i => i.impact < 0).reduce((sum, i) => sum + i.impact, 0);

    const selectedStore = STORES_DATA.find(s => s.id === selectedStoreId);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-3">
            {/* SECTION A: Sticky Header */}
            <div className="bg-white rounded-lg border border-slate-200 px-4 py-2 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <h2 className="text-lg font-bold text-slate-800">Auditoría en Curso</h2>

                    {/* Store Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <Package size={16} className="text-slate-500" />
                            <span className="font-medium text-slate-700">{selectedStore?.name || 'Seleccionar Tienda'}</span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </button>

                        {showStoreDropdown && (
                            <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto w-64 z-30">
                                {STORES_DATA.map(store => (
                                    <button
                                        key={store.id}
                                        onClick={() => { setSelectedStoreId(store.id); setShowStoreDropdown(false); }}
                                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between ${store.id === selectedStoreId ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                            }`}
                                    >
                                        <span>{store.name}</span>
                                        <span className="text-xs text-slate-400">{store.city}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${auditStatus === 'not_started' ? 'bg-slate-100 text-slate-600' :
                        auditStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                            auditStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-emerald-100 text-emerald-700'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${auditStatus === 'not_started' ? 'bg-slate-400' :
                            auditStatus === 'partial' ? 'bg-amber-500' :
                                auditStatus === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                                    'bg-emerald-500'
                            }`}></span>
                        {auditStatus === 'not_started' && 'Sin Iniciar'}
                        {auditStatus === 'partial' && 'Parcial'}
                        {auditStatus === 'in_progress' && 'En Progreso'}
                        {auditStatus === 'reconciled' && 'Conciliado'}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                        <History size={16} />
                        Bitácora de Eventos
                    </button>
                    <button
                        disabled={auditStatus !== 'in_progress'}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <CheckCircle2 size={16} />
                        Cerrar Auditoría
                    </button>
                </div>
            </div>

            {/* SECTION B: Split Cards */}
            <div className="grid grid-cols-2 gap-3">
                {/* B.1 Theoretical Card (PDF) */}
                <div className={`bg-white rounded-xl border-2 transition-all ${isDragging ? 'border-blue-500 bg-blue-50' :
                    theoretical.status === 'loaded' ? 'border-emerald-300' :
                        theoretical.status === 'error' ? 'border-red-300 animate-pulse' :
                            'border-slate-200'
                    }`}>
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet size={16} style={{ color: '#06aef0' }} />
                            <h3 className="font-semibold text-slate-800 text-sm">Inventario Teórico</h3>
                            <span className="text-[10px] text-slate-400">(Deber Ser)</span>
                        </div>
                        {theoretical.status === 'loaded' && (
                            <button onClick={handleReplaceFile} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                <RefreshCw size={12} /> Reemplazar
                            </button>
                        )}
                    </div>

                    {theoretical.status === 'empty' ? (
                        /* Empty State - Dropzone */
                        <div
                            className="p-4 flex flex-col items-center justify-center min-h-[120px] cursor-pointer"
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={simulateUpload}
                        >
                            {isUploading ? (
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                    <p className="text-slate-600">Procesando PDF...</p>
                                </div>
                            ) : (
                                <>
                                    <Upload size={28} className={isDragging ? 'text-blue-500' : 'text-slate-400'} />
                                    <p className="font-medium text-slate-700 mt-2 text-sm">Arrastra el Reporte de Valuación (PDF)</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Validará que corresponda a la tienda</p>
                                </>
                            )}
                        </div>
                    ) : theoretical.status === 'error' ? (
                        /* Error State */
                        <div className="p-6 text-center">
                            <AlertTriangle size={40} className="mx-auto text-red-500 mb-3" />
                            <p className="font-medium text-red-700">{theoretical.errorMessage}</p>
                            <button onClick={() => setTheoretical({ status: 'empty', totalItems: 0, totalUnits: 0, totalValue: 0 })}
                                className="mt-3 text-sm text-blue-600 hover:underline">
                                Intentar de nuevo
                            </button>
                        </div>
                    ) : (
                        /* Loaded State */
                        <div className="p-3">
                            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
                                <FileText size={18} className="text-red-500" />
                                <div className="flex-1">
                                    <p className="font-medium text-slate-800 text-sm">{theoretical.fileName}</p>
                                    <p className="text-[10px] text-slate-500">{theoretical.uploadDate}</p>
                                </div>
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            </div>

                            {/* KPIs */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-50 rounded p-2 text-center">
                                    <p className="text-lg font-bold text-slate-800">{theoretical.totalItems.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500">SKUs</p>
                                </div>
                                <div className="bg-slate-50 rounded p-2 text-center">
                                    <p className="text-lg font-bold text-slate-800">{theoretical.totalUnits.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500">Unidades</p>
                                </div>
                                <div className="bg-emerald-50 rounded p-2 text-center">
                                    <p className="text-lg font-bold text-emerald-700">${(theoretical.totalValue / 1000).toFixed(0)}k</p>
                                    <p className="text-[10px] text-emerald-600">Valor</p>
                                </div>
                            </div>

                            <button className="w-full mt-2 py-1.5 border border-slate-200 rounded text-slate-600 text-xs hover:bg-slate-50 flex items-center justify-center gap-1">
                                <Eye size={12} /> Ver Detalle
                            </button>
                        </div>
                    )}
                </div>

                {/* B.2 Physical Card (Live Scanner) */}
                <div className={`bg-white rounded-xl border-2 transition-all ${physical.status === 'active' ? 'border-blue-300' : 'border-slate-200'
                    }`}>
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className={physical.status === 'active' ? 'text-blue-500' : 'text-slate-400'} />
                            <h3 className="font-semibold text-slate-800 text-sm">Inventario Físico</h3>
                            <span className="text-[10px] text-slate-400">(Realidad)</span>
                        </div>
                        {physical.status === 'active' && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                LIVE
                            </span>
                        )}
                    </div>

                    {physical.status === 'disconnected' ? (
                        <div className="p-4 flex flex-col items-center justify-center min-h-[120px]">
                            <WifiOff size={28} className="text-slate-400" />
                            <p className="font-medium text-slate-600 mt-2 text-sm">Esperando sincronización</p>
                            <p className="text-[10px] text-slate-400 mt-1">No hay escaneos aún</p>
                        </div>
                    ) : (
                        <div className="p-3">
                            <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded-lg">
                                <Wifi size={18} className="text-blue-500" />
                                <div className="flex-1">
                                    <p className="font-medium text-blue-800 text-sm">Conexión Activa</p>
                                    <p className="text-[10px] text-blue-600 flex items-center gap-1">
                                        <Clock size={9} /> {physical.lastSync}
                                    </p>
                                </div>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="bg-blue-50 rounded p-2 text-center">
                                    <p className="text-lg font-bold text-blue-700">{physical.scannedItems}</p>
                                    <p className="text-[10px] text-blue-600">Escaneados</p>
                                </div>
                                <div className="bg-slate-50 rounded p-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <Users size={12} className="text-slate-500" />
                                        <p className="text-base font-bold text-slate-700">{physical.activeUsers.length}</p>
                                    </div>
                                    <p className="text-[10px] text-slate-500">Usuarios</p>
                                </div>
                            </div>

                            {theoretical.status === 'loaded' && (
                                <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                                        <span className="text-slate-500">Progreso</span>
                                        <span className="font-medium text-slate-700">
                                            {physical.scannedItems} / {theoretical.totalItems} ({Math.round((physical.scannedItems / theoretical.totalItems) * 100)}%)
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${(physical.scannedItems / theoretical.totalItems) * 100}%`,
                                                backgroundColor: '#06aef0'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-2 flex items-center gap-1">
                                <span className="text-[10px] text-slate-500">Contando:</span>
                                {physical.activeUsers.map((user, i) => (
                                    <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{user}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION C: Reconciliation Table */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                {theoretical.status !== 'loaded' || physical.status !== 'active' ? (
                    /* Waiting State */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <BarChart3 size={48} className="text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Esperando datos para conciliar</p>
                        <p className="text-sm text-slate-400 max-w-md mt-1">
                            {theoretical.status !== 'loaded' && 'Sube el PDF de valuación'}{theoretical.status !== 'loaded' && physical.status !== 'active' && ' y '}{physical.status !== 'active' && 'espera los escaneos de la App de Escritorio'} para ver las diferencias.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="px-3 py-2 border-b border-slate-100 flex gap-2">
                            {highValueDiffs > 0 && (
                                <button
                                    onClick={() => setFilter('missing')}
                                    className="flex-1 bg-red-50 border border-red-200 rounded px-2 py-1.5 text-left hover:bg-red-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1 text-red-700">
                                        <AlertCircle size={14} />
                                        <span className="font-medium text-xs">{highValueDiffs} Diferencias Altas (&gt;$5k)</span>
                                    </div>
                                </button>
                            )}
                            {unlistedProducts > 0 && (
                                <button
                                    onClick={() => setFilter('all')}
                                    className="flex-1 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-left hover:bg-amber-100 transition-colors"
                                >
                                    <div className="flex items-center gap-1 text-amber-700">
                                        <Package size={14} />
                                        <span className="font-medium text-xs">{unlistedProducts} No Listados en PDF</span>
                                    </div>
                                </button>
                            )}
                            <div className="bg-slate-800 rounded px-3 py-1.5 text-white min-w-[140px]">
                                <p className="text-[10px] text-slate-300">Impacto Faltantes</p>
                                <p className="text-base font-bold text-red-400">${Math.abs(totalNegativeImpact).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex gap-2">
                                {(['all', 'differences', 'missing'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${filter === f
                                            ? 'text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        style={filter === f ? { backgroundColor: '#06aef0' } : {}}
                                    >
                                        {f === 'all' && 'Ver Todo'}
                                        {f === 'differences' && 'Diferencias'}
                                        {f === 'missing' && 'Faltantes'}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar SKU..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1 border border-slate-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium w-24">SKU</th>
                                        <th className="px-3 py-2 text-left font-medium">Producto</th>
                                        <th className="px-3 py-2 text-right font-medium w-24">Costo</th>
                                        <th className="px-3 py-2 text-right font-medium w-16 bg-slate-100">Teórico</th>
                                        <th className="px-3 py-2 text-right font-medium w-16 bg-blue-50 text-blue-700">Físico</th>
                                        <th className="px-3 py-2 text-right font-medium w-16">Dif</th>
                                        <th className="px-3 py-2 text-right font-medium w-24">Impacto</th>
                                        <th className="px-3 py-2 text-center font-medium w-24">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredItems.map((item) => (
                                        <tr key={item.sku} className="hover:bg-slate-50">
                                            <td className="px-3 py-1.5 font-mono text-xs">{item.sku}</td>
                                            <td className="px-3 py-1.5 text-slate-700">{item.name}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">${item.unitCost.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-600">{item.theoretical}</td>
                                            <td className="px-3 py-1.5 text-right bg-blue-50 font-bold text-blue-700">{item.physical}</td>
                                            <td className={`px-3 py-1.5 text-right font-bold ${item.difference === 0 ? 'text-emerald-600' :
                                                item.difference < 0 ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {item.difference === 0 ? (
                                                    <span className="flex items-center justify-end gap-1">
                                                        <CheckCircle2 size={12} /> OK
                                                    </span>
                                                ) : (
                                                    `${item.difference > 0 ? '+' : ''}${item.difference}`
                                                )}
                                            </td>
                                            <td className={`px-3 py-1.5 text-right font-bold ${item.impact === 0 ? 'text-slate-400' :
                                                item.impact < 0 ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {item.impact !== 0 ? `$${item.impact.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-center">
                                                {item.difference !== 0 && (
                                                    <select className="text-xs border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                                                        <option>Justificar...</option>
                                                        <option>Merma</option>
                                                        <option>Robo</option>
                                                        <option>Error</option>
                                                        <option>Recontar</option>
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuditsView;
