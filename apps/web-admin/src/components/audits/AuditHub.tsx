/**
 * AuditHub Component - Enterprise with Lifecycle Management
 * - Auto-archive: LOCKED > 24h → History
 * - Fecha Inicio column (DD/M/YYYY format)
 * - Kebab menu with admin actions (Ver Detalle, Forzar Cierre, Cancelar)
 * - CANCELLED status with gray badge
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Store, Play, CheckCircle2, Lock, KeyRound,
    Search, Calendar, ChevronRight, Plus, ChevronDown, Globe, Eye, XCircle, Clock,
    ChevronLeft, FileUp, ScanLine, ArrowUpDown, MoreVertical, LockKeyhole,
    FileSpreadsheet, FileDown, Loader2, Trash2, RefreshCw, MapPin, ArrowLeft, Check
} from 'lucide-react';

import { auditApi } from '../../services/audit.api';
import usersApi, { type Zone as ZoneType, type Store as UserStoreType } from '../../services/users.api';
import { useAudit } from '../../context/AuditContext';
import { DateRangePicker } from '../ui/DateRangePicker';

// Format date as DD/M/YYYY (strict format per spec)
const formatDateDDMYYYY = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Types with full lifecycle states
export type AuditSessionStatus =
    | 'WAITING_PDF'      // Esperando PDF (falta documento)
    | 'WAITING_COUNT'    // PDF subido, esperando conteo físico
    | 'IN_PROGRESS'      // Conteo físico en progreso
    | 'LOCKED_BY_STORE'  // Finalizada por tienda (bloqueada)
    | 'REOPEN_REQUEST'   // Solicitud de reapertura pendiente
    | 'ARCHIVED'         // Archivada (histórico)
    | 'CANCELLED';       // Cancelada (soft-delete)

export type FocusFilter = 'all' | 'exceptions' | 'in_progress';
export type SortField = 'store' | 'loss' | 'progress' | 'date';
export type SortDir = 'asc' | 'desc';

export interface AuditSession {
    id: string;
    storeId: number;
    storeName: string;
    managerName: string;
    status: AuditSessionStatus;
    hasPdf: boolean;
    createdAt: string;        // Fecha de inicio (DD/M/YYYY)
    lockedAt?: string;        // When store locked it
    closedAt?: string;        // When audit was closed
    completedAt?: string;
    finalizedBy?: string;
    percentComplete: number;
    currentLoss: number;
    theoreticalItems: number;
    scannedItems: number;
    scanLogsCount: number;    // For delete logic (hard vs soft)
}

// Helper to check 24h lock
const isLockedOver24h = (lockedAt?: string): boolean => {
    if (!lockedAt) return false;
    const lockedDate = new Date(lockedAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - lockedDate.getTime()) / (1000 * 60 * 60);
    return hoursElapsed > 24;
};

// interface AuditHubProps removed

const AuditHub: React.FC = () => {
    const navigate = useNavigate();
    // Use context instead of local state (HU10)
    const { audits, loading: isLoading, loadAudits } = useAudit();

    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [focusFilter, setFocusFilter] = useState<FocusFilter>('all');

    // Debugging
    useEffect(() => {
        console.log('AuditHub: Raw audits from context:', audits);
    }, [audits]);

    // Sorting
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Filters
    const [filterStoreIds, setFilterStoreIds] = useState<Set<number>>(new Set()); // empty = global
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Zones data for context switcher drill-down
    const [zones, setZones] = useState<ZoneType[]>([]);
    const [allStores, setAllStores] = useState<UserStoreType[]>([]);
    const [contextZoneId, setContextZoneId] = useState<number | null>(null);

    useEffect(() => {
        Promise.all([usersApi.getZones(), usersApi.getStores()]).then(([z, s]) => {
            setZones(z);
            setAllStores(s);
        }).catch(err => console.error('Failed to load zones/stores:', err));
    }, []);

    // Context Switcher
    const [showContextDropdown, setShowContextDropdown] = useState(false);
    const contextRef = useRef<HTMLDivElement>(null);

    // Kebab Menu State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        type: 'close' | 'cancel';
        session: AuditSession | null;
        loading: boolean;
    }>({ open: false, type: 'cancel', session: null, loading: false });

    // Reopen Requests from POS
    const [reopenRequests, setReopenRequests] = useState<any[]>([]);

    // Fetch pending reopen requests
    useEffect(() => {
        const fetchReopenRequests = async () => {
            try {
                const data = await auditApi.getPendingReopenRequests();
                setReopenRequests(data.requests || []);
            } catch (err) {
                console.error('Failed to fetch reopen requests:', err);
            }
        };
        fetchReopenRequests();
        // Refresh every 30 seconds
        const interval = setInterval(fetchReopenRequests, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
                setShowContextDropdown(false);
            }
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Map backend DTO to UI model
    const sessions: AuditSession[] = (audits || []).map(item => {
        const s = item.session;

        // Map Status — pdf_url drives "Esperando PDF" regardless of counting progress
        let status: AuditSessionStatus = 'IN_PROGRESS';
        if (s.status === 'closed' || s.status === 'COMPLETED' || s.status === 'finalizado') status = 'LOCKED_BY_STORE';
        else if (s.status === 'ARCHIVED') status = 'ARCHIVED';
        else if (s.status === 'CANCELLED') status = 'CANCELLED';
        else if (!s.pdf_url) status = 'WAITING_PDF';  // No PDF yet — always show "Esperando PDF"
        else if (s.status === 'COUNTING' || ((s.status === 'IN_PROGRESS' || s.status === 'activa') && (item.scanned_skus || 0) > 0)) status = 'IN_PROGRESS';
        else if (s.status === 'waiting_count' || s.status === 'IN_PROGRESS' || s.status === 'waiting_valuation') status = 'WAITING_COUNT';
        else status = 'WAITING_PDF';

        // If it's finalized but recent, we treat it effectively as "Active" for the purpose of the list,
        // though the status badge will show it's locked/completed.
        // This logic will be used in the filtering below.

        const theoretical = item.theoretical_skus || 0;
        const scanned = item.scanned_skus || 0;

        let percent = 0;
        if (status === 'LOCKED_BY_STORE' || status === 'ARCHIVED') {
            percent = 100;
        } else if (theoretical > 0) {
            // Use 1 decimal place for better precision on large audits
            percent = Number(((scanned / theoretical) * 100).toFixed(1));
        }

        return {
            id: s.id.toString(),
            storeId: s.store_id,
            storeName: item.store_name,
            managerName: 'Admin User',
            status: status,
            hasPdf: !!s.pdf_url,
            createdAt: s.created_at,
            closedAt: s.closed_at || undefined,
            percentComplete: percent,
            currentLoss: item.total_loss || 0,
            theoreticalItems: theoretical,
            scannedItems: scanned,
            scanLogsCount: 0
        };
    });

    // Reset page when filters change
    const filterStoreKey = Array.from(filterStoreIds).sort().join(',');
    useEffect(() => {
        setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, focusFilter, filterStoreKey, filterDateFrom, filterDateTo, sortField, sortDir]);

    // Auto-refresh audits every 30s while this page is visible
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) {
                loadAudits();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [loadAudits]);

    // Helper to check if closed more than 24h ago
    const isClosedOver24h = (closedAt?: string): boolean => {
        if (!closedAt) return false;
        const closedDate = new Date(closedAt);
        const now = new Date();
        const hoursElapsed = (now.getTime() - closedDate.getTime()) / (1000 * 60 * 60);
        return hoursElapsed > 24;
    };

    // Session categorization with auto-archive logic
    // Active: IN_PROGRESS, WAITING_PDF, WAITING_COUNT, LOCKED_BY_STORE (< 24h), REOPEN_REQUEST
    // History: ARCHIVED, CANCELLED, LOCKED_BY_STORE (> 24h closed)
    const getActiveSessions = () => {
        return sessions.filter(s => {
            if (s.status === 'ARCHIVED' || s.status === 'CANCELLED') return false;
            if (s.status === 'LOCKED_BY_STORE' && isLockedOver24h(s.lockedAt)) return false;
            if (s.status === 'LOCKED_BY_STORE' && isClosedOver24h(s.closedAt)) return false;
            return true;
        });
    };

    const getHistorySessions = () => {
        return sessions.filter(s => {
            if (s.status === 'ARCHIVED' || s.status === 'CANCELLED') return true;
            if (s.status === 'LOCKED_BY_STORE' && isLockedOver24h(s.lockedAt)) return true;
            if (s.status === 'LOCKED_BY_STORE' && isClosedOver24h(s.closedAt)) return true;
            return false;
        });
    };

    const activeSessions = getActiveSessions();
    const historySessions = getHistorySessions();

    // Auto-populate date filters with min/max closed_at dates from history
    useEffect(() => {
        if (historySessions.length > 0 && filterDateFrom === '' && filterDateTo === '') {
            // Use closedAt for history sessions
            const closedDates = historySessions
                .filter(s => s.closedAt)
                .map(s => new Date(s.closedAt!));

            if (closedDates.length > 0) {
                const minDate = new Date(Math.min(...closedDates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...closedDates.map(d => d.getTime())));

                // Format as YYYY-MM-DD using local timezone
                const formatDate = (d: Date) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                setFilterDateFrom(formatDate(minDate));
                setFilterDateTo(formatDate(maxDate));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historySessions.length]);

    const inProgressSessions = activeSessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'WAITING_PDF');
    const exceptionSessions = activeSessions.filter(s => s.status === 'REOPEN_REQUEST');

    // Apply store filter to any session list
    const applyStoreFilter = (sessions: AuditSession[]) => {
        if (filterStoreIds.size === 0) return sessions;
        return sessions.filter(s => filterStoreIds.has(s.storeId));
    };

    // Filtered counts for display (update when store filter changes)
    const filteredActiveSessions = applyStoreFilter(activeSessions);
    const filteredHistorySessions = applyStoreFilter(historySessions);
    const filteredInProgressSessions = applyStoreFilter(inProgressSessions);
    const filteredExceptionSessions = applyStoreFilter(exceptionSessions);

    const getFilteredHistory = () => {
        let filtered = applyStoreFilter(historySessions);

        // Helper to extract date string (YYYY-MM-DD) from any date format
        const getDateString = (dateStr: string): string => {
            const d = new Date(dateStr);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (filterDateFrom) {
            filtered = filtered.filter(s => {
                const closeDate = s.closedAt;
                if (!closeDate) return false;
                const closeDateStr = getDateString(closeDate);
                return closeDateStr >= filterDateFrom;
            });
        }
        if (filterDateTo) {
            filtered = filtered.filter(s => {
                const closeDate = s.closedAt;
                if (!closeDate) return false;
                const closeDateStr = getDateString(closeDate);
                return closeDateStr <= filterDateTo;
            });
        }
        return filtered;
    };

    const getFilteredByFocus = () => {
        if (activeTab === 'history') return getFilteredHistory();
        const baseList = (() => {
            switch (focusFilter) {
                case 'exceptions': return exceptionSessions;
                case 'in_progress': return inProgressSessions;
                default: return activeSessions;
            }
        })();
        return applyStoreFilter(baseList);
    };

    // Sorting logic
    const sortSessions = (sessions: AuditSession[]) => {
        return [...sessions].sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'store':
                    comparison = a.storeName.localeCompare(b.storeName);
                    break;
                case 'loss':
                    comparison = a.currentLoss - b.currentLoss;
                    break;
                case 'progress':
                    comparison = a.percentComplete - b.percentComplete;
                    break;
                case 'date':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
            }
            return sortDir === 'asc' ? comparison : -comparison;
        });
    };

    const allFilteredSessions = sortSessions(getFilteredByFocus());

    useEffect(() => {
        console.log('AuditHub: Filtered sessions:', allFilteredSessions);
        console.log('AuditHub: Active Tab:', activeTab);
        console.log('AuditHub: Focus Filter:', focusFilter);
    }, [allFilteredSessions, activeTab, focusFilter]);

    // Pagination
    const totalItems = allFilteredSessions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const displayedSessions = allFilteredSessions.slice(startIndex, startIndex + itemsPerPage);

    const showPagination = activeTab === 'history' || totalItems > 20;

    // Extract unique stores from actual audit data (not mock)
    const uniqueStoresMap = new Map<number, string>();
    audits.forEach(audit => {
        uniqueStoresMap.set(audit.session.store_id, audit.store_name);
    });
    const realStores = Array.from(uniqueStoresMap.entries()).map(([id, name]) => ({ id, name }));


    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    // Admin Actions
    const handleForceClose = (session: AuditSession) => {
        setOpenMenuId(null);
        setConfirmModal({ open: true, type: 'close', session, loading: false });
    };

    const handleCancelSession = (session: AuditSession) => {
        setOpenMenuId(null);
        setConfirmModal({ open: true, type: 'cancel', session, loading: false });
    };

    const confirmModalAction = async () => {
        if (!confirmModal.session) return;
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
            if (confirmModal.type === 'close') {
                await auditApi.closeAudit(parseInt(confirmModal.session.id));
            } else {
                await auditApi.deleteAudit(parseInt(confirmModal.session.id));
            }
            await loadAudits();
            setConfirmModal({ open: false, type: 'cancel', session: null, loading: false });
        } catch (err) {
            setConfirmModal(prev => ({ ...prev, loading: false }));
            alert('Error: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    const handleViewDetail = (session: AuditSession) => {
        navigate(session.id.toString(), { state: { storeName: session.storeName } });
        setOpenMenuId(null);
    };

    // Download Excel (CSV) for a specific audit
    const handleDownloadExcel = async (e: React.MouseEvent, session: AuditSession) => {
        e.stopPropagation();
        try {
            const auditId = parseInt(session.id);
            const [auditData, scans] = await Promise.all([
                auditApi.getAudit(auditId),
                auditApi.getPhysicalScans(auditId)
            ]);

            const physicalMap = new Map<string, number>();
            scans.forEach(scan => {
                if (scan.sku) {
                    physicalMap.set(scan.sku, (physicalMap.get(scan.sku) || 0) + scan.quantity);
                }
            });

            const headers = ['SKU', 'Descripci\u00f3n', 'Precio Unitario', 'Cant. Te\u00f3rico', 'Cant. F\u00edsico', 'Diferencia', 'Impacto ($)'];
            const rows = auditData.items.map(item => {
                const physical = physicalMap.get(item.product_code) || 0;
                const diff = physical - item.expected_qty;
                const impact = diff * item.unit_cost;
                return [
                    item.product_code,
                    `"${item.product_name.replace(/"/g, '""')}"`,
                    item.unit_cost?.toFixed(2) || '0.00',
                    item.expected_qty.toString(),
                    physical.toString(),
                    diff.toString(),
                    impact.toFixed(2)
                ];
            });

            const BOM = '\uFEFF';
            const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.download = `Auditoria_${session.storeName.replace(/\s+/g, '_')}_${date}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Error al descargar Excel: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    // Download PDF for a specific audit (navigates to detail for now)
    const handleDownloadPDF = (e: React.MouseEvent, session: AuditSession) => {
        e.stopPropagation();
        navigate(session.id.toString(), { state: { storeName: session.storeName, autoExportPDF: true } });
    };

    /**
     * Estado Badge (pasivo)
     */
    const renderStatusBadge = (session: AuditSession) => {
        if (session.status === 'WAITING_PDF') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                    <FileUp size={12} />
                    Esperando PDF
                </span>
            );
        }

        if (session.status === 'WAITING_COUNT') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <Clock size={12} />
                    Esperando Conteo
                </span>
            );
        }

        if (session.status === 'IN_PROGRESS') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <ScanLine size={12} />
                    En Conteo
                </span>
            );
        }

        if (session.status === 'LOCKED_BY_STORE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <Lock size={12} />
                    Finalizado
                </span>
            );
        }

        if (session.status === 'REOPEN_REQUEST') {
            return (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        alert(`Autorizar reapertura para ${session.storeName}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm"
                >
                    <KeyRound size={12} />
                    Autorizar
                </button>
            );
        }

        if (session.status === 'CANCELLED') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                    <XCircle size={12} />
                    Cancelada
                </span>
            );
        }

        if (session.status === 'ARCHIVED') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                    <CheckCircle2 size={12} />
                    Cerrada
                </span>
            );
        }

        return null;
    };

    const renderProgressBar = (session: AuditSession) => {
        if (session.status === 'WAITING_PDF') {
            return <span className="text-slate-200">—</span>;
        }

        const percent = session.percentComplete;
        const barColor = percent === 100 ? 'bg-emerald-500' : 'bg-blue-500';

        return (
            <div className="flex items-center gap-2">
                <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${barColor} rounded-full transition-all`}
                        style={{ width: `${percent}%` }}
                    ></div>
                </div>
                <span className="text-xs text-slate-500 tabular-nums w-10 text-right">{percent}%</span>
            </div>
        );
    };

    const renderLossColumn = (loss: number) => {
        if (loss === 0) {
            return <span className="text-slate-400 text-sm">$0</span>;
        }

        const absLoss = Math.abs(loss);
        const isBig = absLoss > 10000;

        if (loss > 0) {
            return (
                <span className={`text-emerald-600 tabular-nums ${isBig ? 'font-bold' : 'font-medium'}`}>
                    +${absLoss.toLocaleString()}
                </span>
            );
        }

        return (
            <span className={`text-red-600 tabular-nums ${isBig ? 'font-bold' : 'font-normal'}`}>
                -${absLoss.toLocaleString()}
            </span>
        );
    };

    // Toggle a single store in the filter
    const toggleStoreFilter = (storeId: number) => {
        setFilterStoreIds(prev => {
            const next = new Set(prev);
            if (next.has(storeId)) next.delete(storeId);
            else next.add(storeId);
            return next;
        });
    };

    // Toggle all stores in a zone
    const toggleZoneFilter = (zoneId: number) => {
        const zoneStoreIds = allStores.filter(s => s.zone_id === zoneId).map(s => s.id);
        setFilterStoreIds(prev => {
            const next = new Set(prev);
            const allSelected = zoneStoreIds.every(id => next.has(id));
            if (allSelected) {
                zoneStoreIds.forEach(id => next.delete(id));
            } else {
                zoneStoreIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleGlobalView = () => {
        setFilterStoreIds(new Set());
        setShowContextDropdown(false);
        setContextZoneId(null);
    };

    const clearFilters = () => {
        setFilterStoreIds(new Set());
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    // Get label for the context switcher button
    const getContextLabel = () => {
        if (filterStoreIds.size === 0) return 'Vista Global';
        if (filterStoreIds.size === 1) {
            const id = Array.from(filterStoreIds)[0];
            return allStores.find(s => s.id === id)?.name || 'Tienda';
        }
        return `${filterStoreIds.size} tiendas`;
    };

    // SortHeader removed from here, will be defined outside or inlined
    const renderSortHeader = (field: SortField, label: string) => (
        <button
            onClick={() => handleSort(field)}
            className="flex items-center gap-1 hover:text-slate-700 transition-colors"
        >
            {label}
            <ArrowUpDown size={12} className={sortField === field ? 'text-blue-500' : 'text-slate-300'} />
        </button>
    );

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
            {/* REOPEN REQUESTS BANNER */}
            {reopenRequests.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="bg-amber-100 p-2 rounded-lg">
                        <RefreshCw size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-semibold text-amber-800">
                            {reopenRequests.length} solicitud{reopenRequests.length !== 1 ? 'es' : ''} de reapertura pendiente{reopenRequests.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-amber-600 mt-0.5">
                            {reopenRequests.map(r => r.store_name).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(', ')}
                            {' — '}
                            Abre el detalle de la auditoría y presiona "Reabrir Auditoría" para aprobar.
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {reopenRequests.slice(0, 3).map((req: any) => (
                            <button
                                key={req.id}
                                onClick={() => navigate(`/dashboard/audits/${req.audit_id}`)}
                                className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-800 px-3 py-1.5 rounded-lg font-medium transition-colors"
                            >
                                Auditoría #{req.audit_id}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div className="relative" ref={contextRef}>
                    <button
                        onClick={() => { setShowContextDropdown(!showContextDropdown); setContextZoneId(null); }}
                        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                    >
                        {filterStoreIds.size === 0 ? (
                            <Globe size={18} className="text-slate-500" />
                        ) : (
                            <Store size={18} className="text-blue-500" />
                        )}
                        <span className="font-medium text-slate-700">
                            {getContextLabel()}
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{allStores.length}</span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${showContextDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showContextDropdown && (
                        <div className="absolute top-full mt-2 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            {contextZoneId === null ? (
                                /* ZONE LIST VIEW */
                                <>
                                    <button
                                        onClick={handleGlobalView}
                                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 border-b border-slate-100 ${filterStoreIds.size === 0 ? 'bg-blue-50' : ''}`}
                                    >
                                        <Globe size={16} className={filterStoreIds.size === 0 ? 'text-blue-600' : 'text-slate-400'} />
                                        <span className={`text-sm font-medium flex-1 text-left ${filterStoreIds.size === 0 ? 'text-blue-700' : 'text-slate-600'}`}>Vista Global</span>
                                        {filterStoreIds.size === 0 && <Check size={16} className="text-blue-600" />}
                                    </button>

                                    <div className="max-h-72 overflow-y-auto">
                                        {zones.map(zone => {
                                            const zoneStores = allStores.filter(s => s.zone_id === zone.id);
                                            const selectedCount = zoneStores.filter(s => filterStoreIds.has(s.id)).length;
                                            const allSelected = zoneStores.length > 0 && selectedCount === zoneStores.length;
                                            return (
                                                <div key={zone.id} className="flex items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                    {/* Zone checkbox */}
                                                    <button
                                                        onClick={() => toggleZoneFilter(zone.id)}
                                                        className="pl-4 pr-2 py-2.5 flex items-center"
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                            allSelected ? 'bg-blue-600 border-blue-600' :
                                                            selectedCount > 0 ? 'bg-blue-100 border-blue-400' :
                                                            'border-slate-300'
                                                        }`}>
                                                            {allSelected && <Check size={12} className="text-white" />}
                                                            {!allSelected && selectedCount > 0 && <div className="w-2 h-0.5 bg-blue-500 rounded" />}
                                                        </div>
                                                    </button>
                                                    {/* Zone row → drill-down */}
                                                    <button
                                                        onClick={() => setContextZoneId(zone.id)}
                                                        className="flex-1 flex items-center justify-between pr-3 py-2.5"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <MapPin size={14} className="text-slate-400" />
                                                            <span className="text-sm font-medium text-slate-700">{zone.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {selectedCount > 0 && (
                                                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                                                    {selectedCount}
                                                                </span>
                                                            )}
                                                            <span className="text-xs font-medium text-slate-500">{zoneStores.length}</span>
                                                            <ChevronRight size={14} className="text-slate-300" />
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                /* STORE LIST WITHIN ZONE */
                                <>
                                    <button
                                        onClick={() => setContextZoneId(null)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <ArrowLeft size={14} className="text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            {zones.find(z => z.id === contextZoneId)?.name || 'Zona'}
                                        </span>
                                    </button>
                                    {(() => {
                                        const zoneStores = allStores.filter(s => s.zone_id === contextZoneId);
                                        const allSelected = zoneStores.length > 0 && zoneStores.every(s => filterStoreIds.has(s.id));
                                        return (
                                            <button
                                                onClick={() => toggleZoneFilter(contextZoneId)}
                                                className="w-full px-4 py-2 flex items-center gap-2 hover:bg-slate-50 border-b border-slate-100 transition-colors"
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                    allSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                                }`}>
                                                    {allSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-500">Seleccionar toda la zona</span>
                                            </button>
                                        );
                                    })()}
                                    <div className="max-h-64 overflow-y-auto">
                                        {allStores.filter(s => s.zone_id === contextZoneId).map(store => (
                                            <label
                                                key={store.id}
                                                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={filterStoreIds.has(store.id)}
                                                    onChange={() => toggleStoreFilter(store.id)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <Store size={14} className="text-slate-400" />
                                                <span className="text-sm text-slate-700 font-medium">{store.name}</span>
                                            </label>
                                        ))}
                                        {allStores.filter(s => s.zone_id === contextZoneId).length === 0 && (
                                            <div className="px-4 py-3 text-xs text-slate-400 text-center">Sin tiendas en esta zona</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => navigate('new')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Nueva Auditoría
                </button>
            </div>

            {/* MAIN CARD */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                {/* TOOLBAR */}
                <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => { setActiveTab('active'); setFocusFilter('all'); }}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'active'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                }`}
                        >
                            Activas ({filteredActiveSessions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'history'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                }`}
                        >
                            Historial ({filteredHistorySessions.length})
                        </button>
                    </div>


                    <div className="flex items-center gap-3">
                        {isLoading && <span className="text-xs text-slate-400">Cargando datos...</span>}
                        {activeTab === 'active' && (
                            <>
                                {filteredExceptionSessions.length > 0 && (
                                    <button
                                        onClick={() => setFocusFilter(focusFilter === 'exceptions' ? 'all' : 'exceptions')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${focusFilter === 'exceptions'
                                            ? 'bg-orange-200 text-orange-900 border-2 border-orange-400'
                                            : 'bg-orange-100 text-orange-700 border border-orange-300 hover:border-orange-400'
                                            }`}
                                    >
                                        <KeyRound size={14} />
                                        <span className="font-bold tabular-nums">{filteredExceptionSessions.length}</span>
                                        <span>Pendientes</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setFocusFilter(focusFilter === 'in_progress' ? 'all' : 'in_progress')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${focusFilter === 'in_progress'
                                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300'
                                        }`}
                                >
                                    <Play size={14} />
                                    <span className="font-bold tabular-nums">{filteredInProgressSessions.length}</span>
                                    <span className="text-blue-600">En Curso</span>
                                </button>
                            </>
                        )}

                        {activeTab === 'history' && (
                            <>
                                {/* Date Range Picker - Compact version */}
                                <DateRangePicker
                                    fromDate={filterDateFrom}
                                    toDate={filterDateTo}
                                    onFromDateChange={setFilterDateFrom}
                                    onToDateChange={setFilterDateTo}
                                    onClear={clearFilters}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* TABLE */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-500 text-xs uppercase tracking-wide">
                                <th className="px-4 py-3 text-left font-medium">
                                    {renderSortHeader('store', 'TIENDA')}
                                </th>
                                <th className="px-4 py-3 text-left font-medium">ESTADO</th>
                                {/* Activas: AVANCE primero, luego FECHA INICIO */}
                                {activeTab !== 'history' && (
                                    <th className="px-4 py-3 text-left font-medium">
                                        {renderSortHeader('progress', 'AVANCE')}
                                    </th>
                                )}
                                <th className="px-4 py-3 text-left font-medium">
                                    {renderSortHeader('date', 'FECHA INICIO')}
                                </th>
                                {/* Historial: FECHA CIERRE después de FECHA INICIO */}
                                {activeTab === 'history' && (
                                    <th className="px-4 py-3 text-left font-medium">FECHA CIERRE</th>
                                )}
                                <th className="px-4 py-3 text-right font-medium">
                                    <div className="flex items-center justify-end">
                                        {renderSortHeader('loss', 'DISCREPANCIA')}
                                    </div>
                                </th>
                                {activeTab === 'history' && (
                                    <th className="px-4 py-3 text-center font-medium">REPORTE</th>
                                )}
                                <th className="px-4 py-3 w-12 text-center font-medium">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={activeTab === 'history' ? 7 : 6} className="px-4 py-16 text-center">
                                        <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
                                        <p className="font-semibold text-slate-700">¡Todo en orden!</p>
                                        <p className="text-sm text-slate-500 mt-1">No hay auditorías en esta vista</p>
                                    </td>
                                </tr>
                            ) : (
                                displayedSessions.map((session, idx) => (
                                    <tr
                                        key={session.id}
                                        onClick={() => navigate(session.id.toString(), { state: { storeName: session.storeName } })}
                                        className={`border-b border-slate-100 cursor-pointer transition-colors ${session.status === 'REOPEN_REQUEST' ? 'bg-orange-50/60' :
                                            session.status === 'CANCELLED' ? 'bg-slate-50' :
                                                (idx % 2 === 1 ? 'bg-slate-50/40' : '')
                                            } hover:bg-blue-50/50`}
                                    >
                                        {/* TIENDA */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session.status === 'REOPEN_REQUEST' ? 'bg-orange-100' :
                                                    session.status === 'CANCELLED' ? 'bg-slate-200' : 'bg-slate-100'
                                                    }`}>
                                                    <Store size={18} className={
                                                        session.status === 'REOPEN_REQUEST' ? 'text-orange-600' :
                                                            session.status === 'CANCELLED' ? 'text-slate-400' : 'text-slate-500'
                                                    } />
                                                </div>
                                                <div>
                                                    <p className={`font-medium ${session.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                        {session.storeName}
                                                    </p>
                                                    <p className="text-xs text-slate-400">{session.managerName}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* ESTADO */}
                                        <td className="px-4 py-3">
                                            {renderStatusBadge(session)}
                                        </td>

                                        {/* AVANCE (active only - antes de FECHA INICIO) */}
                                        {activeTab !== 'history' && (
                                            <td className="px-4 py-3">
                                                {renderProgressBar(session)}
                                            </td>
                                        )}

                                        {/* FECHA INICIO (DD/M/YYYY) */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatDateDDMYYYY(session.createdAt)}
                                            </div>
                                        </td>

                                        {/* FECHA CIERRE (history only - después de FECHA INICIO) */}
                                        {activeTab === 'history' && (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    {session.closedAt ? formatDateDDMYYYY(session.closedAt) : '-'}
                                                </div>
                                            </td>
                                        )}

                                        {/* DISCREPANCIA */}
                                        <td className="px-4 py-3 text-right">
                                            {renderLossColumn(session.currentLoss)}
                                        </td>

                                        {/* REPORTE (history only) */}
                                        {activeTab === 'history' && (
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => handleDownloadExcel(e, session)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                                        title="Descargar Excel"
                                                    >
                                                        <FileSpreadsheet size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDownloadPDF(e, session)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                        title="Descargar PDF"
                                                    >
                                                        <FileDown size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}

                                        {/* ACCIONES - Kebab Menu */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="relative" ref={openMenuId === session.id ? menuRef : null}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === session.id ? null : session.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {openMenuId === session.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 text-left">
                                                        {/* Ver Detalle */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleViewDetail(session); }}
                                                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                        >
                                                            <Eye size={14} />
                                                            Ver Detalle
                                                        </button>

                                                        {/* Forzar Cierre - Only for active non-locked sessions */}
                                                        {activeTab === 'active' && session.status !== 'LOCKED_BY_STORE' && session.status !== 'CANCELLED' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleForceClose(session); }}
                                                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                            >
                                                                <LockKeyhole size={14} />
                                                                Forzar Cierre
                                                            </button>
                                                        )}

                                                        {/* Divider */}
                                                        {session.status !== 'CANCELLED' && (
                                                            <div className="border-t border-slate-100 my-1"></div>
                                                        )}

                                                        {/* Cancelar - Destructive (Red) */}
                                                        {session.status !== 'CANCELLED' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCancelSession(session); }}
                                                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                            >
                                                                <XCircle size={14} />
                                                                Cancelar Auditoría
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                {showPagination && totalItems > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>Filas:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                className="border border-slate-200 rounded px-2 py-1 text-sm bg-white"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>

                        <span className="text-sm text-slate-500 tabular-nums">
                            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)} de {totalItems}
                        </span>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmModal.open && confirmModal.session && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmModal.type === 'cancel' ? 'bg-red-100' : 'bg-amber-100'
                                }`}>
                                {confirmModal.type === 'cancel'
                                    ? <Trash2 className="w-6 h-6 text-red-600" />
                                    : <LockKeyhole className="w-6 h-6 text-amber-600" />
                                }
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                {confirmModal.type === 'cancel'
                                    ? '¿Eliminar auditoría?'
                                    : '¿Forzar cierre?'
                                }
                            </h3>
                            <p className="text-slate-500 mb-1">
                                <span className="font-semibold text-slate-700">{confirmModal.session.storeName}</span>
                            </p>
                            <p className="text-sm text-slate-400 mb-6">
                                {confirmModal.type === 'cancel'
                                    ? 'Esta acción eliminará permanentemente la auditoría y todos sus datos asociados. No se puede deshacer.'
                                    : 'El estado cambiará a "Finalizado" y se registrará en la bitácora. Podrás reabrir desde el detalle.'
                                }
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setConfirmModal({ open: false, type: 'cancel', session: null, loading: false })}
                                    disabled={confirmModal.loading}
                                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmModalAction}
                                    disabled={confirmModal.loading}
                                    className={`flex-1 py-2.5 px-4 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${confirmModal.type === 'cancel'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-amber-600 hover:bg-amber-700'
                                        }`}
                                >
                                    {confirmModal.loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : confirmModal.type === 'cancel' ? (
                                        'Eliminar'
                                    ) : (
                                        'Cerrar Auditoría'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );

};

export default AuditHub;
