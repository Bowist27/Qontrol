/**
 * AuditsView Component - HU-11: Centro de Comando de Auditoría
 * 3 Sections: Header (sticky), Split Cards (Teórico + Físico), Reconciliation Table
 */

import { useState, useEffect } from 'react';
import {
    ChevronDown, FileText, Upload, Wifi, WifiOff, Clock, Users, AlertTriangle,
    CheckCircle2, RefreshCw, Eye, Search, FileSpreadsheet, X,
    Activity, AlertCircle, Package, BarChart3, History, MapPin, Calendar, User
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
    const [activeTab, setActiveTab] = useState<'all' | 'differences' | 'extras'>('differences'); // Default to discrepancies
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [selectedItem, setSelectedItem] = useState<DiffItem | null>(null);

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

    // Filter diff items based on active tab
    const filteredItems = diffItems.filter(item => {
        const matchesSearch = item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === 'differences') return matchesSearch && item.difference !== 0;
        if (activeTab === 'extras') return matchesSearch && item.theoretical === 0 && item.physical > 0;
        return matchesSearch;
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Stats for tabs and alerts
    const totalProducts = diffItems.length;
    const discrepanciesCount = diffItems.filter(i => i.difference !== 0).length;
    const extrasCount = diffItems.filter(i => i.theoretical === 0 && i.physical > 0).length;
    const highValueDiffs = diffItems.filter(i => i.impact < -5000).length;
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
                        {/* Action Bar: Tabs LEFT | Tools RIGHT (Dumbbell Pattern) */}
                        <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
                            {/* Left: Tabs */}
                            <div className="flex">
                                <button
                                    onClick={() => { setActiveTab('differences'); setCurrentPage(1); }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'differences'
                                        ? 'border-red-500 text-red-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    🚨 Discrepancias ({discrepanciesCount})
                                </button>
                                <button
                                    onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'all'
                                        ? 'border-blue-500 text-blue-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    📋 Todos ({totalProducts})
                                </button>
                                <button
                                    onClick={() => { setActiveTab('extras'); setCurrentPage(1); }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'extras'
                                        ? 'border-amber-500 text-amber-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    🆕 Extras ({extrasCount})
                                </button>
                            </div>

                            {/* Right: Search + Density + Tool Icons (Grouped) */}
                            <div className="flex items-center gap-2">
                                {/* Search Input - Enhanced */}
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por SKU, Producto..."
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-64 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
                                    />
                                </div>

                                {/* Separator */}
                                <div className="h-8 w-px bg-slate-200"></div>

                                {/* Tool Buttons */}
                                <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Exportar Excel">
                                    <FileSpreadsheet size={20} />
                                </button>
                                <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Recargar datos">
                                    <RefreshCw size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Alert Banner with Integrated KPI */}
                        <div className={`px-4 py-2 border-b flex items-center justify-between ${highValueDiffs > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} className={highValueDiffs > 0 ? 'text-amber-600' : 'text-red-600'} />
                                <span className="text-sm text-slate-700">
                                    {highValueDiffs > 0
                                        ? `${highValueDiffs} productos con diferencia mayor a $5,000 MXN`
                                        : `${discrepanciesCount} productos con diferencias detectadas`
                                    }
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Pérdida Total:</span>
                                <span className="text-lg font-bold text-red-700 tabular-nums">
                                    ${Math.abs(totalNegativeImpact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Data Grid - Enterprise Style */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 z-10">
                                    {/* Group Headers */}
                                    <tr className="bg-slate-100 border-b border-slate-300">
                                        <th colSpan={2} className="px-3 py-1.5 text-left font-semibold text-slate-700 text-xs uppercase tracking-wide">
                                            Producto
                                        </th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-slate-600 text-xs uppercase tracking-wide bg-gray-200 border-l border-slate-300">
                                            Según PDF (Teórico)
                                        </th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-blue-800 text-xs uppercase tracking-wide bg-blue-100 border-l border-slate-300">
                                            Según Conteo (Físico)
                                        </th>
                                        <th colSpan={2} className="px-3 py-1.5 text-center font-semibold text-slate-700 text-xs uppercase tracking-wide border-l border-slate-300">
                                            Resultado
                                        </th>
                                    </tr>
                                    {/* Column Headers */}
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                        <th className="px-3 py-1.5 text-left font-medium text-xs w-28">SKU</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-xs">Descripción</th>
                                        <th className="px-3 py-1.5 text-right font-medium text-xs w-20 bg-gray-100 border-l border-slate-200">Cant.</th>
                                        <th className="px-3 py-1.5 text-right font-medium text-xs w-20 bg-blue-50 border-l border-slate-200 text-blue-700">Cant.</th>
                                        <th className="px-3 py-1.5 text-right font-medium text-xs w-16 border-l border-slate-200">Dif.</th>
                                        <th className="px-3 py-1.5 text-right font-medium text-xs w-28 border-l border-slate-200">Impacto ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                                No hay productos que mostrar en esta pestaña
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedItems.map((item, idx) => (
                                            <tr
                                                key={item.sku}
                                                onClick={() => setSelectedItem(item)}
                                                className={`border-b border-slate-100 cursor-pointer transition-colors
                                                    ${selectedItem?.sku === item.sku ? 'bg-blue-100 hover:bg-blue-100' : 'hover:bg-slate-50'}
                                                    ${item.difference !== 0 && selectedItem?.sku !== item.sku ? 'bg-red-50/40' : ''}
                                                    ${idx % 2 === 1 && selectedItem?.sku !== item.sku && item.difference === 0 ? 'bg-slate-25' : ''}`}
                                            >
                                                {/* SKU - Monospace */}
                                                <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{item.sku}</td>
                                                {/* Description */}
                                                <td className="px-3 py-1.5 text-slate-700 text-xs">{item.name}</td>
                                                {/* Teórico - Gray Column Tinting */}
                                                <td className="px-3 py-1.5 text-right bg-gray-50 text-gray-700 font-medium tabular-nums border-l border-slate-100">
                                                    {item.theoretical}
                                                </td>
                                                {/* Físico - Blue Column Tinting */}
                                                <td className="px-3 py-1.5 text-right bg-blue-50/70 text-blue-700 font-bold tabular-nums border-l border-slate-100">
                                                    {item.physical}
                                                </td>
                                                {/* Diferencia */}
                                                <td className={`px-3 py-1.5 text-right font-bold tabular-nums border-l border-slate-100 ${item.difference === 0 ? 'text-emerald-600' :
                                                        item.difference < 0 ? 'text-red-700' : 'text-amber-600'
                                                    }`}>
                                                    {item.difference === 0 ? (
                                                        <span className="flex items-center justify-end gap-1">
                                                            <CheckCircle2 size={12} className="text-emerald-500" />
                                                            <span className="text-emerald-600 text-xs">OK</span>
                                                        </span>
                                                    ) : (
                                                        `${item.difference > 0 ? '+' : ''}${item.difference}`
                                                    )}
                                                </td>
                                                {/* Impacto - Financial Tabular */}
                                                <td className={`px-3 py-1.5 text-right font-semibold tabular-nums border-l border-slate-100 ${item.impact === 0 ? 'text-slate-400' :
                                                        item.impact < 0 ? 'text-red-700' : 'text-emerald-600'
                                                    }`}>
                                                    {item.impact !== 0 ? `$${Math.abs(item.impact).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer - Enterprise Style */}
                        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                            {/* Left: Rows per page */}
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span>Filas por página:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            {/* Center: Info */}
                            <span className="text-sm text-slate-500 tabular-nums">
                                {filteredItems.length > 0
                                    ? `${((currentPage - 1) * itemsPerPage) + 1}–${Math.min(currentPage * itemsPerPage, filteredItems.length)} de ${filteredItems.length}`
                                    : '0 productos'
                                }
                            </span>

                            {/* Right: Navigation */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Primera página"
                                >
                                    ««
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ‹ Anterior
                                </button>
                                <span className="px-3 py-1 text-sm font-medium text-slate-700 tabular-nums">
                                    {currentPage} / {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Siguiente ›
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Última página"
                                >
                                    »»
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Detail Drawer - Slides from Right (Master-Detail Pattern) */}
            <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl border-l border-slate-200 transition-all duration-300 ease-in-out z-30 ${selectedItem ? 'w-96 translate-x-0' : 'w-96 translate-x-full'
                }`}>
                {selectedItem && (
                    <div className="h-full flex flex-col">
                        {/* Drawer Header */}
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">Detalle del Producto</h3>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Product Info */}
                        <div className="p-4 border-b border-slate-100">
                            <p className="font-mono text-xs text-slate-500 mb-1">{selectedItem.sku}</p>
                            <h4 className="font-semibold text-slate-800 text-lg">{selectedItem.name}</h4>
                            <p className="text-sm text-slate-500 mt-1">Costo unitario: ${selectedItem.unitCost.toLocaleString()}</p>
                        </div>

                        {/* Comparison Card */}
                        <div className="p-4 border-b border-slate-100">
                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Comparación de Inventario</h5>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500 mb-1">Según PDF</p>
                                    <p className="text-2xl font-bold text-gray-700 tabular-nums">{selectedItem.theoretical}</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-blue-600 mb-1">Conteo Físico</p>
                                    <p className="text-2xl font-bold text-blue-700 tabular-nums">{selectedItem.physical}</p>
                                </div>
                            </div>
                            <div className={`mt-3 p-3 rounded-lg text-center ${selectedItem.difference === 0 ? 'bg-emerald-50' :
                                selectedItem.difference < 0 ? 'bg-red-50' : 'bg-amber-50'
                                }`}>
                                <p className="text-xs text-slate-500 mb-1">Diferencia</p>
                                <p className={`text-xl font-bold tabular-nums ${selectedItem.difference === 0 ? 'text-emerald-600' :
                                    selectedItem.difference < 0 ? 'text-red-700' : 'text-amber-600'
                                    }`}>
                                    {selectedItem.difference === 0 ? '✓ OK' : `${selectedItem.difference > 0 ? '+' : ''}${selectedItem.difference}`}
                                </p>
                            </div>
                        </div>

                        {/* Financial Impact */}
                        {selectedItem.difference !== 0 && (
                            <div className="p-4 border-b border-slate-100">
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Impacto Financiero</h5>
                                <div className={`p-3 rounded-lg ${selectedItem.impact < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                    <p className={`text-2xl font-bold tabular-nums ${selectedItem.impact < 0 ? 'text-red-700' : 'text-emerald-600'}`}>
                                        ${Math.abs(selectedItem.impact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {selectedItem.impact < 0 ? 'Pérdida estimada' : 'Excedente encontrado'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Scan History Placeholder (HU-13) */}
                        <div className="p-4 flex-1 overflow-auto">
                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                Historial de Escaneos
                            </h5>
                            <div className="space-y-2">
                                <div className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <User size={14} className="text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-700">Juan García</p>
                                        <p className="text-xs text-slate-500">Escaneó {selectedItem.physical} unidades</p>
                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                            <Clock size={10} /> Hace 15 min • <MapPin size={10} /> Pasillo A3
                                        </p>
                                    </div>
                                </div>
                                {selectedItem.difference !== 0 && (
                                    <div className="flex items-start gap-3 p-2 bg-amber-50 rounded-lg">
                                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <AlertTriangle size={14} className="text-amber-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-amber-700">Discrepancia Detectada</p>
                                            <p className="text-xs text-slate-500">Se requiere verificación manual</p>
                                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                                <Calendar size={10} /> {new Date().toLocaleDateString('es-MX')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Footer */}
                        {selectedItem.difference !== 0 && (
                            <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <button className="w-full py-2 px-4 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors">
                                    Justificar Diferencia
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Overlay when drawer is open */}
            {selectedItem && (
                <div
                    className="fixed inset-0 bg-black/20 z-20"
                    onClick={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
};

export default AuditsView;
