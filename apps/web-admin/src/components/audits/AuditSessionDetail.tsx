/**
 * AuditSessionDetail Component - HU-11: Centro de Comando de Auditoría
 * 3 Sections: Header (sticky), Split Cards (Teórico + Físico), Reconciliation Table
 * 
 * Receives sessionId from parent (AuditsView orchestrator) to load specific session data.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    FileText, Upload, Wifi, WifiOff, Clock, Users, AlertTriangle,
    CheckCircle2, RefreshCw, Search, FileSpreadsheet, X, ArrowLeft,
    Activity, AlertCircle, BarChart3, History, MapPin, Calendar, User,
    ChevronDown, Store, Save, Loader2
} from 'lucide-react';
import { auditApi, type Store as StoreType, type PhysicalScan, type AuditEvent } from '../../services/audit.api';

// Types
type AuditStatus = 'not_started' | 'partial' | 'in_progress' | 'reconciled' | 'locked';

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
    totalQuantity: number;
    uniqueProducts: number;
    unknownItems: number;
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

// Props interface removed

// Format large currency values: >= 1M shows as "1.92M", < 1M shows as "450k"
const formatCurrencyCompact = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(absValue / 1000000).toFixed(2)}M`;
    } else {
        return `$${(absValue / 1000).toFixed(0)}k`;
    }
};



const AuditSessionDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    // Detect new audit: static "new" route has id=undefined, OR path ends with /new
    const isNewAudit = !id || location.pathname.endsWith('/new');
    const _sessionId = id; // Mapping to existing logic variable legacy name

    // Legacy mapping functions
    const onBack = () => navigate('/dashboard/audits');

    // Store name state for existing audits (fetched from API or passed via state)
    const [existingStoreName, setExistingStoreName] = useState(location.state?.storeName || '');
    // Store selector state for new audit
    const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [storeSearch, setStoreSearch] = useState('');
    const [stores, setStores] = useState<StoreType[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(true);
    const [storesError, setStoresError] = useState<string | null>(null);

    // Event Log State
    const [showEventLog, setShowEventLog] = useState(false);
    const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);

    useEffect(() => {
        if (showEventLog && _sessionId) {
            setIsLoadingEvents(true);
            auditApi.getAuditEvents(parseInt(_sessionId))
                .then(data => setAuditEvents(data))
                .catch(err => console.error('Failed to load events', err))
                .finally(() => setIsLoadingEvents(false));
        }
    }, [showEventLog, _sessionId]);

    // Fetch stores from API on mount (always, to ensure we can resolve store name if state is missing)
    useEffect(() => {
        setIsLoadingStores(true);
        setStoresError(null);
        auditApi.getStores()
            .then(data => {
                setStores(data);
                setIsLoadingStores(false);
            })
            .catch(err => {
                console.error('Failed to load stores:', err);
                setStoresError('Error al cargar tiendas');
                setIsLoadingStores(false);
            });
    }, []);

    // Get the effective store name (used when creating new audit vs viewing existing)
    // If not passed in state, try to find in loaded stores list by matching store_id (if we had it available easily here, but we fetch it in getAudit)
    // We'll update existingStoreName in the getAudit effect if needed
    const effectiveStoreName = isNewAudit && selectedStoreId
        ? stores.find(s => s.id === selectedStoreId)?.name || ''
        : existingStoreName;

    // Log for debugging - will be used for API calls in future
    console.debug('[AuditSession] Store:', effectiveStoreName || 'Not selected');

    // In future: fetch session data based on sessionId
    const [theoretical, setTheoretical] = useState<TheoreticalData>({ status: 'empty', totalItems: 0, totalUnits: 0, totalValue: 0 });
    const [physical, setPhysical] = useState<PhysicalData>({
        status: 'disconnected',
        scannedItems: 0,
        totalQuantity: 0,
        uniqueProducts: 0,
        unknownItems: 0,
        activeUsers: []
    });
    const [physicalScans, setPhysicalScans] = useState<PhysicalScan[]>([]);
    const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'differences' | 'extras'>('differences'); // Default to discrepancies
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [selectedItem, setSelectedItem] = useState<DiffItem | null>(null);

    // Modal and save states
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);


    const [, setIsLoadingSession] = useState(false);

    // ========== PHYSICAL SCAN POLLING ==========
    // Poll for physical scans when viewing an existing audit
    useEffect(() => {
        if (isNewAudit || !_sessionId || _sessionId === 'new') return;

        const auditId = parseInt(_sessionId);
        if (isNaN(auditId)) return;

        const fetchPhysicalData = async () => {
            try {
                const [scans, summary] = await Promise.all([
                    auditApi.getPhysicalScans(auditId),
                    auditApi.getPhysicalScanSummary(auditId)
                ]);

                setPhysicalScans(scans);

                // Extract unique device IDs as "users"
                const devices = [...new Set(scans.map(s => s.device_id).filter(Boolean))];

                setPhysical({
                    status: summary.total_scans > 0 ? 'active' : 'disconnected',
                    scannedItems: summary.total_scans,
                    totalQuantity: summary.total_quantity,
                    uniqueProducts: summary.unique_products,
                    unknownItems: summary.unknown_items,
                    activeUsers: devices as string[],
                    lastSync: summary.last_scan_at
                        ? `Hace ${Math.round((Date.now() - new Date(summary.last_scan_at).getTime()) / 1000)}s`
                        : undefined
                });

                // Update diffItems with physical counts
                if (scans.length > 0) {
                    setDiffItems(prev => {
                        // Create a map of SKU -> total physical quantity
                        const physicalMap = new Map<string, number>();
                        scans.forEach(scan => {
                            if (scan.sku) {
                                const current = physicalMap.get(scan.sku) || 0;
                                physicalMap.set(scan.sku, current + scan.quantity);
                            }
                        });

                        // Update each item with physical count
                        return prev.map(item => {
                            const physicalQty = physicalMap.get(item.sku) || 0;
                            return {
                                ...item,
                                physical: physicalQty,
                                difference: physicalQty - item.theoretical,
                                impact: (physicalQty - item.theoretical) * item.unitCost
                            };
                        });
                    });
                }
            } catch (err) {
                console.error('Failed to fetch physical scans:', err);
            }
        };

        // Initial fetch
        fetchPhysicalData();

        // Poll every 3 seconds
        const pollInterval = setInterval(fetchPhysicalData, 3000);

        return () => clearInterval(pollInterval);
    }, [isNewAudit, _sessionId]);

    // Load existing audit data when opening a saved session
    useEffect(() => {
        console.log('[AuditSessionDetail] Loading check:', { isNewAudit, _sessionId });
        if (!isNewAudit && _sessionId && _sessionId !== 'new') {
            console.log('[AuditSessionDetail] Loading existing audit:', _sessionId);
            setIsLoadingSession(true);
            auditApi.getAudit(parseInt(_sessionId))
                .then((data) => {
                    console.log('[AuditSessionDetail] Loaded audit data:', data.items?.length, 'items');
                    // If no store name from state, try to find it in the stores list using store_id
                    // If no store name from state, try to find it in the stores list using store_id
                    if (!existingStoreName && stores.length > 0) {
                        const foundStore = stores.find(s => s.id === data.session.store_id);
                        if (foundStore) setExistingStoreName(foundStore.name);
                    } else if (!existingStoreName) {
                        // Fallback: fetch just this store if we can't find it in the list (or wait for list to load)
                        auditApi.getStores().then(fetchedStores => {
                            const found = fetchedStores.find(s => s.id === data.session.store_id);
                            if (found) setExistingStoreName(found.name);
                        });
                    }

                    // Populate theoretical data
                    const items: DiffItem[] = data.items.map(item => ({
                        sku: item.product_code,
                        name: item.product_name,
                        unitCost: item.unit_cost,
                        theoretical: item.expected_qty,
                        physical: 0, // No physical count yet
                        difference: -item.expected_qty,
                        impact: -(item.unit_cost * item.expected_qty) // Negative for loss calculation
                    }));

                    setDiffItems(items);
                    setTheoretical({
                        status: 'loaded',
                        fileName: decodeURIComponent((data.session.pdf_url?.split('/').pop()?.split('?')[0]) || 'PDF Cargado'),
                        uploadDate: new Date(data.session.created_at).toLocaleString(),
                        totalItems: items.length,
                        totalUnits: items.reduce((sum, i) => sum + i.theoretical, 0),
                        totalValue: items.reduce((sum, i) => sum + Math.abs(i.impact), 0)
                    });
                })
                .catch(err => {
                    console.error('Failed to load audit:', err);
                })
                .finally(() => {
                    setIsLoadingSession(false);
                });
        }
    }, [isNewAudit, _sessionId, existingStoreName, stores]);

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
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    // Handle File Input
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    // Export to Excel (CSV format compatible with Excel)
    const exportToExcel = () => {
        if (diffItems.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        // Headers
        const headers = ['SKU', 'Descripción', 'Precio Unitario', 'Cant. Teórico', 'Cant. Físico', 'Diferencia', 'Impacto ($)'];

        // Data rows
        const rows = diffItems.map(item => [
            item.sku,
            `"${item.name.replace(/"/g, '""')}"`, // Escape quotes in names
            item.unitCost?.toFixed(2) || '0.00',
            item.theoretical.toString(),
            item.physical.toString(),
            item.difference.toString(),
            item.impact.toFixed(2)
        ]);

        // Build CSV content with BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Filename with store name and date
        const storeName = stores.find(s => s.id === selectedStoreId)?.name || 'Auditoria';
        const date = new Date().toISOString().split('T')[0];
        link.download = `Auditoria_${storeName.replace(/\s+/g, '_')}_${date}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Scroll to top on page change
    useEffect(() => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentPage]);

    // FASE 3: Parse PDF (Preview)
    const processFile = async (file: File) => {
        if (isNewAudit && !selectedStoreId) {
            alert('Por favor selecciona una tienda primero');
            return;
        }

        setIsUploading(true);
        setUploadedFile(file);

        try {
            // Call API to parse PDF (No save)
            const result = await auditApi.parsePDF(file);

            // Map API items to Frontend DiffItems
            const mappedItems: DiffItem[] = result.items.map(item => ({
                sku: item.product_code,
                name: item.product_name,
                unitCost: item.unit_cost,      // Keep original sign
                theoretical: item.expected_qty,   // Keep original sign
                physical: 0,
                difference: -item.expected_qty,   // Initial diff is full negative if physical is 0
                impact: -(item.expected_qty * item.unit_cost)
            }));

            // Update UI with preview data
            setTheoretical({
                status: 'loaded',
                fileName: file.name,
                uploadDate: new Date().toLocaleString(),
                totalItems: result.total_items,
                totalUnits: result.total_units,
                totalValue: result.total_value,
            });

            setDiffItems(mappedItems);

            // Prepare Physical card (empty/waiting for scans)
            setPhysical({
                status: 'active',
                scannedItems: 0,
                totalQuantity: 0,
                uniqueProducts: 0,
                unknownItems: 0,
                activeUsers: ['Esperando App...'],
                lastSync: 'Pendiente'
            });

            // Auto-select 'All' tab for preview
            setActiveTab('all');

        } catch (error) {
            console.error('Parse error:', error);
            setTheoretical({
                status: 'error',
                totalItems: 0, totalUnits: 0, totalValue: 0,
                errorMessage: error instanceof Error ? error.message : 'Error al procesar el archivo'
            });
            setUploadedFile(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleReplaceFile = () => {
        setTheoretical({ status: 'empty', totalItems: 0, totalUnits: 0, totalValue: 0 });
        setDiffItems([]);
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUpdateAudit = async () => {
        if (!_sessionId || !uploadedFile) return;

        if (!confirm('¿Estás seguro de actualizar el archivo de valuación? Esto recalculará los teóricos. Tu inventario físico se mantendrá intacto.')) {
            return;
        }

        setIsSaving(true);
        try {
            await auditApi.updateAudit(parseInt(_sessionId), uploadedFile);
            alert('Auditoría actualizada exitosamente');
            // Reload page to fetch fresh data
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        } finally {
            setIsSaving(false);
        }
    };

    // Filter diff items based on active tab
    const filteredItems = diffItems.filter(item => {
        const matchesSearch = item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === 'differences') return matchesSearch && item.difference !== 0;
        if (activeTab === 'extras') return matchesSearch && item.difference > 0; // Sobrantes (físico > teórico)
        return matchesSearch;
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Stats for tabs and alerts
    const totalProducts = diffItems.length;
    const discrepanciesCount = diffItems.filter(i => i.difference !== 0).length;
    const extrasCount = diffItems.filter(i => i.difference > 0).length; // Sobrantes (físico > teórico)
    const highValueDiffs = diffItems.filter(i => i.impact < -5000).length;
    const totalNegativeImpact = diffItems.filter(i => i.impact < 0).reduce((sum, i) => sum + i.impact, 0);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-3">
            {/* SECTION A: Sticky Header */}
            <div className="bg-white rounded-lg border border-slate-200 px-4 py-2 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    {/* Back Button */}
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                        title="Volver al Hub"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="h-6 w-px bg-slate-200"></div>

                    <h2 className="text-lg font-bold text-slate-800">
                        {isNewAudit ? 'Nueva Auditoría' : 'Auditoría en Curso'}
                    </h2>

                    {/* Store Selector (New Audit) OR Store Badge (Existing) */}
                    {isNewAudit ? (
                        <div className="relative">
                            <button
                                onClick={() => theoretical.status !== 'loaded' && setShowStoreDropdown(!showStoreDropdown)}
                                disabled={theoretical.status === 'loaded'}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${theoretical.status === 'loaded'
                                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                    : selectedStoreId
                                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300'
                                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                                    }`}
                            >
                                <Store size={16} />
                                <span className="font-medium">
                                    {selectedStoreId
                                        ? stores.find(s => s.id === selectedStoreId)?.name
                                        : isLoadingStores ? 'Cargando...' : 'Selecciona una Tienda'}
                                </span>
                                {theoretical.status !== 'loaded' && !isLoadingStores && <ChevronDown size={16} className={`transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} />}
                                {isLoadingStores && <Loader2 size={16} className="animate-spin text-slate-400" />}
                            </button>

                            {showStoreDropdown && theoretical.status !== 'loaded' && (
                                <div className="absolute top-full mt-2 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-2 border-b border-slate-100">
                                        <input
                                            type="text"
                                            placeholder="Buscar tienda..."
                                            value={storeSearch}
                                            onChange={(e) => setStoreSearch(e.target.value)}
                                            autoFocus
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                        {stores
                                            .filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
                                            .map(store => (
                                                <button
                                                    key={store.id}
                                                    onClick={() => {
                                                        setSelectedStoreId(store.id);
                                                        setShowStoreDropdown(false);
                                                        setStoreSearch('');
                                                    }}
                                                    className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors ${selectedStoreId === store.id ? 'bg-blue-50' : ''
                                                        }`}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${store.status ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    <span className="text-slate-700 font-medium">{store.name}</span>
                                                </button>
                                            ))}
                                        {isLoadingStores && (
                                            <div className="p-4 text-center text-slate-500 text-xs">Cargando tiendas...</div>
                                        )}
                                        {storesError && (
                                            <div className="p-4 text-center text-red-500 text-xs">{storesError}</div>
                                        )}
                                        {stores.length === 0 && !isLoadingStores && !storesError && (
                                            <div className="p-4 text-center text-slate-500 text-xs">No hay tiendas disponibles</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md border border-slate-200">
                            <Store size={14} className="text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">{effectiveStoreName}</span>
                        </div>
                    )}

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
                    {!isNewAudit && (
                        <button
                            onClick={() => setShowEventLog(true)}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                            <History size={16} />
                            Bitácora de Eventos
                        </button>
                    )}

                    {/* Action buttons for creation mode */}
                    {isNewAudit ? (
                        <>
                            {/* Cancel button - shows confirmation modal if PDF loaded */}
                            <button
                                onClick={() => {
                                    if (theoretical.status === 'loaded') {
                                        setShowCancelModal(true);
                                    } else {
                                        onBack();
                                    }
                                }}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <X size={16} />
                                Cancelar
                            </button>

                            {/* Save button - enabled when store selected and PDF loaded */}
                            <button
                                onClick={async () => {
                                    if (!selectedStoreId || !uploadedFile) return;
                                    setIsSaving(true);
                                    try {
                                        // Call API to Create Audit (Saves to DB)
                                        await auditApi.createAudit(selectedStoreId, uploadedFile);
                                        alert('Auditoría creada exitosamente');
                                        onBack();
                                    } catch (err) {
                                        alert('Error al guardar: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={!selectedStoreId || theoretical.status !== 'loaded' || isSaving}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Guardar Auditoría
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        /* Actions for existing audits */
                        <div className="flex items-center gap-2">
                            {uploadedFile ? (
                                <>
                                    <button
                                        onClick={handleReplaceFile}
                                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleUpdateAudit}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        Guardar Cambios
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!_sessionId) return;
                                        if (confirm('¿Estás seguro de que deseas cancelar esta auditoría? Esto eliminará todos los datos asociados.')) {
                                            try {
                                                await auditApi.deleteAudit(parseInt(_sessionId));
                                                alert('Auditoría cancelada exitosamente');
                                                onBack();
                                            } catch (err) {
                                                console.error(err);
                                                alert('Error al cancelar: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                            }
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center gap-2"
                                >
                                    <X size={16} />
                                    Cancelar Auditoría
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* SECTION B: Split Cards */}
            < div className="grid grid-cols-2 gap-3" >
                {/* B.1 Theoretical Card (PDF) */}
                < div className={`rounded-xl border-2 transition-all ${isNewAudit && !selectedStoreId
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : theoretical.status === 'loaded'
                            ? 'border-emerald-300 bg-white'
                            : theoretical.status === 'error'
                                ? 'border-red-300 animate-pulse bg-white'
                                : 'border-slate-200 bg-white'
                    }`}>
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet size={16} style={{ color: isNewAudit && !selectedStoreId ? '#94a3b8' : '#06aef0' }} />
                            <h3 className={`font-semibold text-sm ${isNewAudit && !selectedStoreId ? 'text-slate-400' : 'text-slate-800'}`}>Inventario Teórico</h3>
                            <span className="text-[10px] text-slate-400">(Deber Ser)</span>
                        </div>
                        {theoretical.status === 'loaded' && (
                            <button onClick={handleReplaceFile} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                <RefreshCw size={12} /> Reemplazar
                            </button>
                        )}
                    </div>

                    {/* Locked state when no store selected */}
                    {
                        isNewAudit && !selectedStoreId ? (
                            <div className="p-4 flex flex-col items-center justify-center min-h-[120px] cursor-not-allowed">
                                <Upload size={28} className="text-slate-300" />
                                <p className="font-medium text-slate-400 mt-2 text-sm">Selecciona una tienda arriba</p>
                                <p className="text-[10px] text-slate-400 mt-1">para habilitar la carga del PDF</p>
                            </div>
                        ) : theoretical.status === 'empty' ? (
                            /* Empty State - Dropzone */
                            <div
                                className={`p-6 flex flex-col items-center justify-center border-2 border-dashed rounded-lg m-3 transition-colors cursor-pointer min-h-[120px] ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                    }`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".pdf"
                                    onChange={handleFileSelect}
                                />
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
                                        <p className="text-lg font-bold text-emerald-700">{formatCurrencyCompact(theoretical.totalValue)}</p>
                                        <p className="text-[10px] text-emerald-600">Valor</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >

                {/* B.2 Physical Card (Live Scanner) - Passive in creation mode */}
                < div className={`rounded-xl border-2 transition-all ${isNewAudit
                    ? 'bg-slate-50 border-slate-200'
                    : physical.status === 'active'
                        ? 'border-blue-300 bg-white'
                        : 'border-slate-200 bg-white'
                    }`}>
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className={isNewAudit || physical.status === 'disconnected' ? 'text-slate-400' : 'text-blue-500'} />
                            <h3 className={`font-semibold text-sm ${isNewAudit ? 'text-slate-500' : 'text-slate-800'}`}>Inventario Físico</h3>
                            <span className="text-[10px] text-slate-400">(Realidad)</span>
                        </div>
                        {!isNewAudit && physical.status === 'active' && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                LIVE
                            </span>
                        )}
                    </div>

                    {
                        isNewAudit || physical.status === 'disconnected' ? (
                            <div className="p-4 flex flex-col items-center justify-center min-h-[120px]">
                                <WifiOff size={28} className="text-slate-300" />
                                <p className="font-medium text-slate-500 mt-2 text-sm">
                                    {isNewAudit ? 'Esperando conexión con App...' : 'Esperando sincronización'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {isNewAudit ? 'La tienda escaneará desde la App móvil' : 'No hay escaneos aún'}
                                </p>
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
                                                {physical.uniqueProducts} / {theoretical.totalItems} SKUs ({Math.round((physical.uniqueProducts / theoretical.totalItems) * 100)}%)
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min((physical.uniqueProducts / theoretical.totalItems) * 100, 100)}%`,
                                                    backgroundColor: '#06aef0'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {/* Summary Stats */}
                                <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                                    <div className="bg-blue-50 rounded px-2 py-1">
                                        <p className="text-sm font-bold text-blue-700">{physical.totalQuantity}</p>
                                        <p className="text-[9px] text-blue-600">Unidades</p>
                                    </div>
                                    <div className="bg-emerald-50 rounded px-2 py-1">
                                        <p className="text-sm font-bold text-emerald-700">{physical.uniqueProducts}</p>
                                        <p className="text-[9px] text-emerald-600">Productos</p>
                                    </div>
                                    <div className={`rounded px-2 py-1 ${physical.unknownItems > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                        <p className={`text-sm font-bold ${physical.unknownItems > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{physical.unknownItems}</p>
                                        <p className={`text-[9px] ${physical.unknownItems > 0 ? 'text-amber-600' : 'text-slate-400'}`}>No catalog</p>
                                    </div>
                                </div>

                                {/* Recent Scans List */}
                                {physicalScans.length > 0 && (
                                    <div className="mt-2 border-t border-slate-100 pt-2">
                                        <p className="text-[10px] text-slate-500 mb-1">Últimos escaneos:</p>
                                        <div className="max-h-24 overflow-y-auto space-y-1">
                                            {physicalScans.slice(0, 5).map((scan) => (
                                                <div key={scan.id} className={`flex items-center justify-between text-[10px] px-2 py-1 rounded ${scan.is_unknown ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                                    <div className="flex-1 truncate">
                                                        <span className={`font-medium ${scan.is_unknown ? 'text-amber-700' : 'text-slate-700'}`}>
                                                            {scan.product_name || scan.barcode}
                                                        </span>
                                                    </div>
                                                    <span className="text-blue-600 font-bold ml-2">×{scan.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-2 flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">Dispositivos:</span>
                                    {physical.activeUsers.map((user, i) => (
                                        <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{user}</span>
                                    ))}
                                </div>
                            </div>
                        )
                    }
                </div >
            </div >

            {/* SECTION C: Reconciliation Table */}
            < div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden" >
                {
                    theoretical.status !== 'loaded' ? (
                        /* Waiting State */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <BarChart3 size={48} className="text-slate-300 mb-4" />
                            <p className="text-lg font-medium text-slate-600">Esperando datos para conciliar</p>
                            <p className="text-sm text-slate-400 max-w-md mt-1">
                                Sube el PDF de valuación{physical.status !== 'active' && ' y espera los escaneos de la App de Escritorio'} para ver las diferencias.
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
                                    <button
                                        onClick={exportToExcel}
                                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Exportar Excel"
                                    >
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
                            <div className="flex-1 overflow-auto" ref={tableContainerRef}>
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        {/* Group Headers */}
                                        <tr className="bg-slate-100 border-b border-slate-300">
                                            <th colSpan={3} className="px-3 py-1.5 text-left font-semibold text-slate-700 text-xs uppercase tracking-wide">
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
                                            <th className="px-3 py-1.5 text-right font-medium text-xs w-24">P. Unitario</th>
                                            <th className="px-3 py-1.5 text-right font-medium text-xs w-20 bg-gray-100 border-l border-slate-200">Cant.</th>
                                            <th className="px-3 py-1.5 text-right font-medium text-xs w-20 bg-blue-50 border-l border-slate-200 text-blue-700">Cant.</th>
                                            <th className="px-3 py-1.5 text-right font-medium text-xs w-16 border-l border-slate-200">Dif.</th>
                                            <th className="px-3 py-1.5 text-right font-medium text-xs w-28 border-l border-slate-200">Impacto ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
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
                                                    {/* Precio Unitario */}
                                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums text-xs">
                                                        ${item.unitCost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '—'}
                                                    </td>
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
                                                        {item.impact !== 0 ? `${item.impact < 0 ? '-' : '+'}$${Math.abs(item.impact).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
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
                    )
                }
            </div >

            {/* Detail Drawer - Slides from Right (Master-Detail Pattern) */}
            < div className={`fixed top-0 right-0 h-full bg-white shadow-2xl border-l border-slate-200 transition-all duration-300 ease-in-out z-30 ${selectedItem ? 'w-96 translate-x-0' : 'w-96 translate-x-full'
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
            </div >

            {/* Overlay when drawer is open */}
            {
                selectedItem && (
                    <div
                        className="fixed inset-0 bg-black/20 z-20"
                        onClick={() => setSelectedItem(null)}
                    />
                )
            }

            {/* Cancel Confirmation Modal */}
            {
                showCancelModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                            <div className="p-6">
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle size={24} className="text-amber-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
                                    ¿Descartar auditoría?
                                </h3>
                                <p className="text-sm text-slate-600 text-center">
                                    Ya procesaste el PDF de valuación. Si cancelas, se perderán los datos procesados y tendrás que volver a empezar.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end border-t border-slate-200">
                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                                >
                                    Seguir editando
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false);
                                        onBack();
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                                >
                                    Sí, descartar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Event Log Modal */}
            {
                showEventLog && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                            onClick={() => setShowEventLog(false)}
                        />

                        {/* Drawer */}
                        <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-100">
                            {/* Header */}
                            <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between z-10">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <History size={20} className="text-slate-500" />
                                        Bitácora de Eventos
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">Historial de versiones y cambios</p>
                                </div>
                                <button
                                    onClick={() => setShowEventLog(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Timeline Content */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                                {isLoadingEvents ? (
                                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                                        <Loader2 className="animate-spin text-blue-600" size={32} />
                                        <span className="text-sm text-slate-500">Cargando historial...</span>
                                    </div>
                                ) : (auditEvents || []).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                            <History size={32} />
                                        </div>
                                        <p>No hay eventos registrados</p>
                                    </div>
                                ) : (
                                    <div className="relative space-y-8 pl-4">
                                        {/* Vertical Timeline Line - Now fully connected */}
                                        <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-slate-300 z-0" />

                                        {(auditEvents || []).map((event) => {
                                            const isCreation = event.event_type === 'AUDIT_CREATED';

                                            // Get user initials or default to SYS
                                            const getUserInitials = (userName: string | undefined) => {
                                                if (!userName || userName === 'SISTEMA') return 'SYS';
                                                return userName.substring(0, 2).toUpperCase();
                                            };

                                            const displayName = event.user_name || event.user_id || 'SISTEMA';

                                            return (
                                                <div key={event.id} className="relative flex gap-4 group z-10">
                                                    {/* Timeline Node */}
                                                    <div className={`
                                                        w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm border-2 bg-white
                                                        ${isCreation
                                                            ? 'border-emerald-200 text-emerald-600'
                                                            : 'border-amber-200 text-amber-600'}
                                                    `}>
                                                        {isCreation ? <Upload size={24} /> : <RefreshCw size={24} />}
                                                    </div>

                                                    {/* Content Card */}
                                                    <div className="flex-1 min-w-0">
                                                        {/* Header: Compact but with Date on newline */}
                                                        <div className="mb-2">
                                                            {/* Row 1: Badge + User */}
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className={`
                                                                    text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                                                                    ${isCreation ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'}
                                                                `}>
                                                                    {isCreation ? 'Carga Inicial' : 'Reemplazo'}
                                                                </span>

                                                                <span className="text-[10px] text-slate-400">por</span>

                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <div className={`
                                                                        w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm flex-shrink-0
                                                                        ${event.user_id ? 'bg-slate-700' : 'bg-slate-400'}
                                                                    `}>
                                                                        {getUserInitials(displayName)}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-700 truncate" title={displayName}>
                                                                        {displayName}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Row 2: Date (Subtle) */}
                                                            <div className="pl-1">
                                                                <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                                                    {new Date(event.created_at).toLocaleString(undefined, {
                                                                        year: 'numeric',
                                                                        month: 'numeric',
                                                                        day: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* The Asset (File Link) - Slimmer */}
                                                        {(event.details?.s3_url || event.details?.s3_key) && (
                                                            <div className={`
                                                                rounded-lg border px-3 py-2 mb-3 flex items-center gap-3 transition-all
                                                                ${isCreation
                                                                    ? 'bg-emerald-50/50 border-emerald-100'
                                                                    : 'bg-amber-50/50 border-amber-100'}
                                                            `}>
                                                                <div className={`
                                                                    p-1.5 rounded-md shadow-sm border
                                                                    ${isCreation ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-amber-100 border-amber-200 text-amber-600'}
                                                                `}>
                                                                    {isCreation ? <FileText size={16} /> : <RefreshCw size={16} />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <a
                                                                        href={event.details.s3_url || '#'}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`text-sm font-bold hover:underline truncate block group-hover:text-blue-600 transition-colors ${event.details.s3_url ? 'text-slate-800' : 'text-slate-400 cursor-not-allowed'
                                                                            }`}
                                                                        title={event.details.s3_key}
                                                                    >
                                                                        {event.details.s3_key ? `Archivo Privado (v${event.id})` : 'Archivo no disponible'}
                                                                    </a>
                                                                    <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                                                        {(() => {
                                                                            if (!event.details.s3_key) return 'Sin referencia';
                                                                            try {
                                                                                const parts = event.details.s3_key.split('/');
                                                                                let fileName = parts.pop() || event.details.s3_key;

                                                                                // Robust decoding (max 3 levels to avoid loops)
                                                                                for (let i = 0; i < 3; i++) {
                                                                                    if (!fileName.includes('%')) break;
                                                                                    fileName = decodeURIComponent(fileName);
                                                                                }
                                                                                return fileName;
                                                                            } catch {
                                                                                // Fallback: strip path but show potentially encoded name
                                                                                const parts = event.details.s3_key.split('/');
                                                                                return parts.pop() || event.details.s3_key;
                                                                            }
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                {event.details?.s3_url && (
                                                                    <div className="bg-white p-1 rounded-full border border-slate-100 shadow-sm">
                                                                        <Wifi size={12} className="text-emerald-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Metadata Footer - Bolder Numbers */}
                                                        <div className="flex flex-wrap gap-2">
                                                            {event.details?.items_count !== undefined && (
                                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 shadow-sm">
                                                                    <span className="text-sm font-extrabold text-slate-900">📦 {event.details.items_count}</span>
                                                                    <span className="text-[10px] font-medium text-slate-400 uppercase">Items</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AuditSessionDetail;
