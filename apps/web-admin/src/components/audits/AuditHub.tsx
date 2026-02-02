/**
 * AuditHub Component - Enterprise with Lifecycle Management
 * - Auto-archive: LOCKED > 24h → History
 * - Fecha Inicio column (DD/M/YYYY format)
 * - Kebab menu with admin actions (Ver Detalle, Forzar Cierre, Cancelar)
 * - CANCELLED status with gray badge
 */

import { useState, useRef, useEffect } from 'react';
import {
    Store, TrendingDown, TrendingUp, FileText, Play, CheckCircle2, Lock, KeyRound,
    Search, Calendar, ChevronRight, Plus, ChevronDown, Globe, Eye, XCircle, Clock,
    Filter, RefreshCw, ChevronLeft, X, FileUp, ScanLine, ArrowUpDown, MoreVertical, LockKeyhole
} from 'lucide-react';
import { STORES_DATA } from '../../data/mockData';
import { auditApi } from '../../services/audit.api';
import type { AuditListDTO } from '../../services/audit.api';

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

interface AuditHubProps {
    onSelectSession: (sessionId: string, storeName: string) => void;
}

const AuditHub: React.FC<AuditHubProps> = ({ onSelectSession }) => {
    const [sessions, setSessions] = useState<AuditSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [focusFilter, setFocusFilter] = useState<FocusFilter>('all');

    // Sorting
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Filters
    const [showHistoryFilter, setShowHistoryFilter] = useState(false);
    const [filterStore, setFilterStore] = useState<string>('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const filterRef = useRef<HTMLDivElement>(null);

    // Context Switcher
    const [showContextDropdown, setShowContextDropdown] = useState(false);
    const [contextSearch, setContextSearch] = useState('');
    const contextRef = useRef<HTMLDivElement>(null);

    // Kebab Menu State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
                setShowContextDropdown(false);
            }
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowHistoryFilter(false);
            }
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch real sessions
    useEffect(() => {
        const loadSessions = async () => {
            try {
                const data = await auditApi.getSessions();

                // Map backend DTO to UI model
                const mapped: AuditSession[] = data.map(item => {
                    const s = item.session;

                    // Map Status
                    // IN_PROGRESS with PDF = waiting for physical count
                    // IN_PROGRESS without PDF = waiting for PDF upload
                    let status: AuditSessionStatus = 'IN_PROGRESS';
                    if (s.status === 'UPLOADING' || s.status === 'REVIEW_PENDING') status = 'WAITING_PDF';
                    else if (s.status === 'IN_PROGRESS' && !!s.pdf_url) status = 'WAITING_COUNT';
                    else if (s.status === 'IN_PROGRESS' && !s.pdf_url) status = 'WAITING_PDF';
                    else if (s.status === 'COUNTING') status = 'IN_PROGRESS';
                    else if (s.status === 'COMPLETED') status = 'LOCKED_BY_STORE';
                    else if (s.status === 'ARCHIVED') status = 'ARCHIVED';
                    else if (s.status === 'CANCELLED') status = 'CANCELLED';

                    // Calculate percent (Mock for now as backend doesn't send progress yet)
                    // In real app, querying items count would be expensive here, 
                    // so ideally backend list endpoint sends summary stats.
                    // For now, assume 0% or 100% based on status
                    const percent = status === 'LOCKED_BY_STORE' || status === 'ARCHIVED' ? 100 : 0;

                    return {
                        id: s.id.toString(),
                        storeId: s.store_id,
                        storeName: item.store_name, // Joined name
                        managerName: 'Admin User', // TODO: Get from CreatedBy
                        status: status,
                        hasPdf: !!s.pdf_url,
                        createdAt: s.created_at,
                        percentComplete: percent,
                        currentLoss: 0, // TODO: Backend summary
                        theoreticalItems: 0,
                        scannedItems: 0,
                        scanLogsCount: 0
                    };
                });

                setSessions(mapped);
            } catch (err) {
                console.error("Failed to load sessions", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadSessions();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, focusFilter, filterStore, filterDateFrom, filterDateTo, sortField, sortDir]);

    // Session categorization with auto-archive logic
    // Active: IN_PROGRESS, WAITING_PDF, LOCKED_BY_STORE (< 24h), REOPEN_REQUEST
    // History: ARCHIVED, CANCELLED, LOCKED_BY_STORE (> 24h)
    const getActiveSessions = () => {
        return sessions.filter(s => {
            if (s.status === 'ARCHIVED' || s.status === 'CANCELLED') return false;
            if (s.status === 'LOCKED_BY_STORE' && isLockedOver24h(s.lockedAt)) return false;
            return true;
        });
    };

    const getHistorySessions = () => {
        return sessions.filter(s => {
            if (s.status === 'ARCHIVED' || s.status === 'CANCELLED') return true;
            if (s.status === 'LOCKED_BY_STORE' && isLockedOver24h(s.lockedAt)) return true;
            return false;
        });
    };

    const activeSessions = getActiveSessions();
    const historySessions = getHistorySessions();

    const inProgressSessions = activeSessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'WAITING_PDF');
    const exceptionSessions = activeSessions.filter(s => s.status === 'REOPEN_REQUEST');

    const getFilteredHistory = () => {
        let filtered = historySessions;
        if (filterStore !== 'all') {
            filtered = filtered.filter(s => s.storeId === parseInt(filterStore));
        }
        if (filterDateFrom) {
            const fromDate = new Date(filterDateFrom);
            filtered = filtered.filter(s => new Date(s.createdAt) >= fromDate);
        }
        if (filterDateTo) {
            const toDate = new Date(filterDateTo);
            toDate.setHours(23, 59, 59);
            filtered = filtered.filter(s => new Date(s.createdAt) <= toDate);
        }
        return filtered;
    };

    const getFilteredByFocus = () => {
        if (activeTab === 'history') return getFilteredHistory();
        switch (focusFilter) {
            case 'exceptions': return exceptionSessions;
            case 'in_progress': return inProgressSessions;
            default: return activeSessions;
        }
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

    // Pagination
    const totalItems = allFilteredSessions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const displayedSessions = allFilteredSessions.slice(startIndex, startIndex + itemsPerPage);

    const showPagination = activeTab === 'history' || totalItems > 20;

    const filteredStores = STORES_DATA.filter(store =>
        store.name.toLowerCase().includes(contextSearch.toLowerCase())
    );

    const totalLoss = activeSessions.reduce((sum, s) => sum + s.currentLoss, 0);
    const hasActiveFilters = filterStore !== 'all' || filterDateFrom || filterDateTo;

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
        // TODO: API call to force lock
        alert(`Forzar cierre para ${session.storeName}\nEstado cambiará a LOCKED_BY_STORE`);
        setOpenMenuId(null);
    };

    const handleCancelSession = (session: AuditSession) => {
        const hasData = session.scanLogsCount > 0;
        const action = hasData ? 'SOFT DELETE (Marcar como CANCELADA)' : 'HARD DELETE (Borrar permanentemente)';

        if (confirm(`¿Cancelar auditoría de ${session.storeName}?\n\nAcción: ${action}\nScans registrados: ${session.scanLogsCount}`)) {
            // TODO: API call
            alert(`Auditoría cancelada.\nAcción ejecutada: ${action}`);
        }
        setOpenMenuId(null);
    };

    const handleViewDetail = (session: AuditSession) => {
        onSelectSession(session.id, session.storeName);
        setOpenMenuId(null);
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
                <span className="text-xs text-slate-500 tabular-nums w-8">{percent}%</span>
            </div>
        );
    };

    const renderLossColumn = (loss: number) => {
        if (loss === 0) {
            return <span className="text-slate-400 text-sm">$0</span>;
        }

        const isPositive = loss < 0;
        const absLoss = Math.abs(loss);
        const isBig = absLoss > 10000;

        if (isPositive) {
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

    const handleStoreSelect = (store: typeof STORES_DATA[0]) => {
        setShowContextDropdown(false);
        setContextSearch('');
        const session = sessions.find(s => s.storeId === store.id && s.status !== 'ARCHIVED' && s.status !== 'CANCELLED');
        if (session) {
            onSelectSession(session.id, session.storeName);
        }
    };

    const clearFilters = () => {
        setFilterStore('all');
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
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
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div className="relative" ref={contextRef}>
                    <button
                        onClick={() => setShowContextDropdown(!showContextDropdown)}
                        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                    >
                        <Globe size={18} className="text-slate-500" />
                        <span className="font-medium text-slate-700">Vista Global</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{STORES_DATA.length}</span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${showContextDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showContextDropdown && (
                        <div className="absolute top-full mt-2 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="p-3 border-b border-slate-100">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar tienda..."
                                        value={contextSearch}
                                        onChange={(e) => setContextSearch(e.target.value)}
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => { setShowContextDropdown(false); setContextSearch(''); }}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 border-b border-slate-100 bg-blue-50"
                            >
                                <Globe size={16} className="text-blue-600" />
                                <span className="text-sm font-medium text-blue-700 flex-1 text-left">Vista Global</span>
                                <CheckCircle2 size={16} className="text-blue-600" />
                            </button>

                            <div className="max-h-64 overflow-y-auto">
                                {filteredStores.map(store => (
                                    <button
                                        key={store.id}
                                        onClick={() => handleStoreSelect(store)}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                                    >
                                        <Store size={14} className="text-slate-400" />
                                        <p className="text-sm font-medium text-slate-700 flex-1 text-left">{store.name}</p>
                                        <ChevronRight size={14} className="text-slate-300" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => onSelectSession('new', '')}
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
                            Activas ({activeSessions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'history'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                }`}
                        >
                            Historial ({historySessions.length})
                        </button>
                    </div>


                    <div className="flex items-center gap-3">
                        {isLoading && <span className="text-xs text-slate-400">Cargando datos...</span>}
                        {activeTab === 'active' && (
                            <>
                                {exceptionSessions.length > 0 && (
                                    <button
                                        onClick={() => setFocusFilter(focusFilter === 'exceptions' ? 'all' : 'exceptions')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${focusFilter === 'exceptions'
                                            ? 'bg-orange-200 text-orange-900 border-2 border-orange-400'
                                            : 'bg-orange-100 text-orange-700 border border-orange-300 hover:border-orange-400'
                                            }`}
                                    >
                                        <KeyRound size={14} />
                                        <span className="font-bold tabular-nums">{exceptionSessions.length}</span>
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
                                    <span className="font-bold tabular-nums">{inProgressSessions.length}</span>
                                    <span className="text-blue-600">En Curso</span>
                                </button>

                                <div className="h-6 w-px bg-slate-200"></div>

                                <div className={`flex items-center gap-1.5 font-bold ${totalLoss > 0 ? 'text-red-700' : 'text-emerald-600'}`}>
                                    {totalLoss > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                    <span className="tabular-nums">
                                        {totalLoss > 0 ? '-' : '+'}${Math.abs(totalLoss / 1000).toFixed(0)}k
                                    </span>
                                </div>
                            </>
                        )}

                        {activeTab === 'history' && (
                            <>
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearFilters}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                                    >
                                        <X size={12} />
                                        Limpiar
                                    </button>
                                )}

                                <div className="relative" ref={filterRef}>
                                    <button
                                        onClick={() => setShowHistoryFilter(!showHistoryFilter)}
                                        className={`p-2 rounded-lg transition-colors ${hasActiveFilters || showHistoryFilter
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        <Filter size={18} />
                                    </button>

                                    {showHistoryFilter && (
                                        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Filtrar</h4>

                                            <div className="mb-3">
                                                <label className="block text-xs text-slate-500 mb-1">Tienda</label>
                                                <select
                                                    value={filterStore}
                                                    onChange={(e) => setFilterStore(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                >
                                                    <option value="all">Todas</option>
                                                    {STORES_DATA.map(store => (
                                                        <option key={store.id} value={store.id}>{store.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Desde</label>
                                                    <input
                                                        type="date"
                                                        value={filterDateFrom}
                                                        onChange={(e) => setFilterDateFrom(e.target.value)}
                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                                                    <input
                                                        type="date"
                                                        value={filterDateTo}
                                                        onChange={(e) => setFilterDateTo(e.target.value)}
                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setShowHistoryFilter(false)}
                                                className="w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                    <RefreshCw size={18} />
                                </button>
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
                                    <SortHeader field="store" label="Tienda" />
                                </th>
                                <th className="px-4 py-3 text-left font-medium">Estado</th>
                                <th className="px-4 py-3 text-left font-medium">
                                    <SortHeader field="progress" label="Avance" />
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    <div className="flex items-center justify-end">
                                        <SortHeader field="loss" label="Riesgo ($)" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                    <SortHeader field="date" label="Fecha Inicio" />
                                </th>
                                {activeTab === 'history' && (
                                    <th className="px-4 py-3 text-center font-medium">Reporte</th>
                                )}
                                <th className="px-4 py-3 w-12 text-center font-medium">Acciones</th>
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
                                        onClick={() => onSelectSession(session.id, session.storeName)}
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

                                        {/* AVANCE */}
                                        <td className="px-4 py-3">
                                            {renderProgressBar(session)}
                                        </td>

                                        {/* RIESGO */}
                                        <td className="px-4 py-3 text-right">
                                            {renderLossColumn(session.currentLoss)}
                                        </td>

                                        {/* FECHA INICIO (DD/M/YYYY) */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatDateDDMYYYY(session.createdAt)}
                                            </div>
                                        </td>

                                        {/* HISTORY: Reporte Button */}
                                        {activeTab === 'history' && (
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                >
                                                    <FileText size={16} />
                                                </button>
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
                                                        {activeTab === 'active' && session.status !== 'CANCELLED' && (
                                                            <div className="border-t border-slate-100 my-1"></div>
                                                        )}

                                                        {/* Cancelar - Destructive (Red) */}
                                                        {activeTab === 'active' && session.status !== 'CANCELLED' && (
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
        </div>
    );

};

export default AuditHub;
