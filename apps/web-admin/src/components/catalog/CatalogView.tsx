import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { catalogApi, type ValuationProduct, type ValuationSummary, type ImportHistoryItem } from '../../services/catalog.api';

type FilterType = 'all' | 'price_up' | 'price_down' | 'new' | 'unchanged';

interface UndoState {
  show: boolean;
  count: number;
  timeLeft: number;
  importId: number;
}

const CatalogView: React.FC = () => {
  // Data state
  const [summary, setSummary] = useState<ValuationSummary | null>(null);
  const [products, setProducts] = useState<ValuationProduct[]>([]);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Drag & Drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchTerm, _setSearchTerm] = useState('');
  
  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // UI state
  const [applying, setApplying] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  
  // Undo state
  const [undoState, setUndoState] = useState<UndoState>({
    show: false,
    count: 0,
    timeLeft: 10,
    importId: 0
  });
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First load history (this should always work)
      const historyData = await catalogApi.getImportHistory(10);
      setHistory(historyData);
      
      // Try to get pending valuation - if none exists, that's OK
      try {
        const [summaryData, productsData] = await Promise.all([
          catalogApi.getLatestValuationSummary(),
          catalogApi.getLatestValuationProducts(),
        ]);
        
        setSummary(summaryData);
        setProducts(productsData);
        
        // Auto-select all products
        const allSkus = new Set(productsData.map(p => p.sku));
        setSelectedProducts(allSkus);
      } catch {
        // No pending valuation - that's fine, show drag & drop
        setSummary(null);
        setProducts([]);
        setSelectedProducts(new Set());
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading catalog data');
    } finally {
      setLoading(false);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFile) {
      await handleFileUpload(pdfFile);
    }
  }, []);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);
      setError(null);
      
      // 1. Analyze the file
      const result = await catalogApi.analyzeReport(file);
      
      // 2. Save the analysis as a pending valuation
      await catalogApi.saveAnalysis(result, 'Administrador');
      
      // 3. Reload data to show the new valuation
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    if (activeFilter !== 'all' && product.changeType !== activeFilter) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        product.sku.toLowerCase().includes(term) ||
        product.name.toLowerCase().includes(term)
      );
    }
    return true;
  }); // No limit - table will scroll, footer stays fixed

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.sku)));
    }
  };

  const toggleProductSelection = (sku: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedProducts(newSelected);
  };

  // Get counts for KPIs
  const getCounts = useCallback(() => {
    const counts = { all: 0, price_up: 0, price_down: 0, new: 0, unchanged: 0 };
    products.forEach(p => {
      counts.all++;
      if (p.changeType === 'price_up') counts.price_up++;
      if (p.changeType === 'price_down') counts.price_down++;
      if (p.changeType === 'new') counts.new++;
      if (p.changeType === 'unchanged') counts.unchanged++;
    });
    return counts;
  }, [products]);

  const counts = getCounts();

  // Apply selected products
  const handleApply = async () => {
    if (selectedProducts.size === 0 || !summary) return;
    
    try {
      setApplying(true);
      
      const skusToApply = Array.from(selectedProducts);
      await catalogApi.commitImport(summary.id, skusToApply);
      
      const appliedCount = selectedProducts.size;
      
      // Show undo toast
      setUndoState({
        show: true,
        count: appliedCount,
        timeLeft: 10,
        importId: summary.id
      });
      
      // Start countdown
      undoIntervalRef.current = setInterval(() => {
        setUndoState(prev => {
          if (prev.timeLeft <= 1) {
            if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            return { ...prev, show: false, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
      
      // Auto-hide after 10 seconds
      undoTimerRef.current = setTimeout(() => {
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
        setUndoState(prev => ({ ...prev, show: false }));
      }, 10000);
      
      // Clear selection and reload
      setSelectedProducts(new Set());
      await loadData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error applying changes');
    } finally {
      setApplying(false);
    }
  };

  // Handle undo
  const handleUndo = async () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    
    try {
      await catalogApi.revertImport(undoState.importId);
      setUndoState(prev => ({ ...prev, show: false }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error reverting changes');
    }
  };

  // Handle discard (X button)
  const handleDiscard = async () => {
    if (!summary) return;
    
    try {
      await catalogApi.discardImport(summary.id);
      setSummary(null);
      setProducts([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descartar la valuación');
    }
  };

  // Handle clear entire catalog
  const handleClearCatalog = async () => {
    try {
      setClearing(true);
      await catalogApi.clearCatalog();
      setShowClearConfirm(false);
      setSummary(null);
      setProducts([]);
      setHistory([]);
      setSelectedProducts(new Set());
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al borrar el catálogo');
    } finally {
      setClearing(false);
    }
  };

  // Format helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  };

  // Badge para la columna "Estado" - Azul claro para Subió, Verde claro para Nuevo
  const getChangeBadge = (type: string) => {
    switch (type) {
      case 'price_up':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Subió
          </span>
        );
      case 'price_down':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-600 border border-amber-100">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Bajó
          </span>
        );
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Nuevo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-400 border border-gray-100">
            Sin cambio
          </span>
        );
    }
  };

  // Handle revert/restore from history - moved up to be available in all states
  const handleRevertFromHistory = async (importId: number) => {
    try {
      setRestoringId(importId);
      setMenuOpenId(null);
      await catalogApi.restoreImport(importId);
      setRestoreConfirmId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restaurar');
    } finally {
      setRestoringId(null);
    }
  };

  // Handle delete individual import from history
  const handleDeleteImport = async (importId: number) => {
    try {
      setDeletingId(importId);
      setMenuOpenId(null);
      // Use discard for pending/reverted, revert for applied (which also removes products)
      const item = history.find(h => h.id === importId);
      if (item?.status === 'pending' || item?.status === 'reverted') {
        await catalogApi.discardImport(importId);
      } else {
        await catalogApi.revertImport(importId);
      }
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // No data state - Show big drag & drop
  if (!summary) {
    return (
      <div className="h-screen bg-gray-100 flex overflow-hidden">
        {/* ===== LEFT SIDEBAR - HISTORIAL ===== */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="font-semibold text-gray-900">Historial</h2>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto overflow-x-visible p-2">
            {history.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No hay historial
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item, index) => {
                  const isFirstApplied = index === history.findIndex(h => h.status === 'applied');
                  const isVigente = item.status === 'applied' && isFirstApplied;
                  
                  const getBadge = () => {
                    if (isVigente) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500 text-white">Vigente</span>;
                    if (item.status === 'applied') return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-400 text-white">Anterior</span>;
                    if (item.status === 'pending') return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500 text-white">Pendiente</span>;
                    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-400 text-white">Desactualizado</span>;
                  };
                  
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">{item.time_ago}</div>
                          <div className="text-xs text-gray-700">
                            <span className="text-blue-600">▲</span> {item.user}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">{item.file_name}</div>
                        </div>
                        {getBadge()}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {item.new_products > 0 && (
                            <span className="text-blue-600">+{item.new_products}</span>
                          )}
                          {item.price_changes > 0 && (
                            <span className="text-orange-600">{item.price_changes} precios</span>
                          )}
                        </div>
                        {!isVigente && (
                          <div className="relative z-10">
                            <button
                              type="button"
                              ref={(el) => { if (el) menuButtonRefs.current.set(item.id, el); }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                console.log('Menu button clicked for item:', item.id);
                                if (menuOpenId === item.id) {
                                  setMenuOpenId(null);
                                  setMenuPosition(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const left = Math.max(10, Math.min(rect.left, window.innerWidth - 170));
                                  setMenuPosition({ top: rect.bottom + 4, left });
                                  setMenuOpenId(item.id);
                                }
                              }}
                              className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4 text-gray-500 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clear Catalog Button */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full px-3 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Borrar Catálogo
            </button>
          </div>
        </div>

        {/* Clear Catalog Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">¿Borrar todo el catálogo?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Esta acción eliminará <strong>todos los productos</strong> y el <strong>historial de importaciones</strong>. 
                    El archivo Excel (LISTADF.xlsx) no se verá afectado y podrás volver a importarlo.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearCatalog}
                  disabled={clearing}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  {clearing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Borrando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Sí, borrar todo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== MAIN CONTENT - BIG DROP ZONE ===== */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
            } ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploadingFile ? (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <p className="text-lg text-gray-600">Procesando reporte de valuación...</p>
              </div>
            ) : (
              <>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
                  isDragging ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Sube tu Reporte de Valuación</h2>
                <p className="text-gray-500 mb-6">Arrastra un archivo PDF aquí o haz clic para seleccionar</p>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Solo archivos PDF de reportes de valuación</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Portal Dropdown Menu - No Summary State */}
        {menuOpenId && menuPosition && createPortal(
          <div 
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => { setMenuOpenId(null); setMenuPosition(null); }}
          >
            <div 
              className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1"
              style={{ 
                top: menuPosition.top, 
                left: menuPosition.left,
                zIndex: 9999,
                minWidth: 160
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const item = history.find(h => h.id === menuOpenId);
                if (!item) return null;
                
                const firstAppliedId = history.find(h => h.status === 'applied')?.id;
                const isVigente = item.id === firstAppliedId && item.status === 'applied';
                const canRestore = item.status === 'reverted' && firstAppliedId;
                
                return (
                  <>
                    {canRestore && (
                      <button
                        onClick={() => {
                          setMenuOpenId(null);
                          setMenuPosition(null);
                          setRestoreConfirmId(menuOpenId);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Restaurar versión
                      </button>
                    )}
                    {!isVigente && (
                      <button
                        onClick={() => {
                          setMenuOpenId(null);
                          setMenuPosition(null);
                          setDeleteConfirmId(menuOpenId);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

        {/* Delete Import Confirmation Modal - No Summary State */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">¿Eliminar esta importación?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Esta acción eliminará permanentemente el registro de esta importación del historial.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteImport(deleteConfirmId)}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  {deletingId === deleteConfirmId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Sí, eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Import Confirmation Modal - No Summary State */}
        {restoreConfirmId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">¿Restaurar esta versión?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Se revertirá la versión vigente actual y se aplicarán los precios de esta importación.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setRestoreConfirmId(null)}
                  disabled={restoringId !== null}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleRevertFromHistory(restoreConfirmId)}
                  disabled={restoringId !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  {restoringId === restoreConfirmId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Restaurando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Sí, restaurar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selectedCount = selectedProducts.size;
  const percentChange = summary.previous_value > 0 
    ? ((summary.total_value - summary.previous_value) / summary.previous_value * 100)
    : (summary.total_value > 0 ? 100 : 0);

  const getStatusBadge = (status: string, isFirst: boolean) => {
    if (status === 'applied' && isFirst) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500 text-white">Vigente</span>;
    }
    switch (status) {
      case 'applied':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-400 text-white">Anterior</span>;
      case 'pending':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500 text-white">Pendiente</span>;
      case 'reverted':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-400 text-white">Desactualizado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Undo Toast */}
      {undoState.show && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Se aplicaron {undoState.count} costos</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleUndo}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                DESHACER
              </button>
              <span className="text-gray-400 text-sm tabular-nums w-6">{undoState.timeLeft}s</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== LEFT SIDEBAR - HISTORIAL ===== */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="font-semibold text-gray-900">Historial</h2>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto overflow-x-visible p-2">
          {history.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No hay historial
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item, index) => {
                const isFirstApplied = index === history.findIndex(h => h.status === 'applied');
                const isVigente = item.status === 'applied' && isFirstApplied;
                
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg transition-colors relative ${
                      summary?.id === item.id 
                        ? 'bg-blue-50 ring-1 ring-blue-500' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">{item.time_ago}</div>
                        <div className="text-xs text-gray-700">
                          <span className="text-blue-600">▲</span> {item.user}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">{item.file_name}</div>
                      </div>
                      {getStatusBadge(item.status, isFirstApplied)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {item.new_products > 0 && (
                          <span className="text-blue-600">+{item.new_products}</span>
                        )}
                        {item.price_changes > 0 && (
                          <span className="text-orange-600">{item.price_changes} precios</span>
                        )}
                      </div>
                      {!isVigente && (
                        <div className="relative z-10">
                          <button
                            type="button"
                            ref={(el) => { if (el) menuButtonRefs.current.set(item.id, el); }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              console.log('Menu button clicked for item:', item.id);
                              if (menuOpenId === item.id) {
                                setMenuOpenId(null);
                                setMenuPosition(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const left = Math.max(10, Math.min(rect.left, window.innerWidth - 170));
                                setMenuPosition({ top: rect.bottom + 4, left });
                                setMenuOpenId(item.id);
                              }
                            }}
                            className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4 text-gray-500 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

          {/* Clear Catalog Button */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full px-3 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Borrar Catálogo
            </button>
          </div>
      </div>

      {/* Clear Catalog Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¿Borrar todo el catálogo?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Esta acción eliminará <strong>todos los productos</strong> y el <strong>historial de importaciones</strong>. 
                  El archivo Excel (LISTADF.xlsx) no se verá afectado y podrás volver a importarlo.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearCatalog}
                disabled={clearing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {clearing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Borrando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Sí, borrar todo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Import Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¿Eliminar esta importación?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {history.find(h => h.id === deleteConfirmId)?.status === 'pending' 
                    ? 'Se descartará esta valuación pendiente sin aplicar cambios.'
                    : 'Se revertirán los cambios de precios aplicados por esta importación.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletingId !== null}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteImport(deleteConfirmId)}
                disabled={deletingId !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {deletingId === deleteConfirmId ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Import Confirmation Modal */}
      {restoreConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¿Restaurar esta versión?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Se revertirá la versión vigente actual y se aplicarán los precios de esta importación.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setRestoreConfirmId(null)}
                disabled={restoringId !== null}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRevertFromHistory(restoreConfirmId)}
                disabled={restoringId !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {restoringId === restoreConfirmId ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Restaurando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Sí, restaurar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal Dropdown Menu */}
      {menuOpenId && menuPosition && createPortal(
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998 }}
          onClick={() => { setMenuOpenId(null); setMenuPosition(null); }}
        >
          <div 
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1"
            style={{ 
              top: menuPosition.top, 
              left: menuPosition.left,
              zIndex: 9999,
              minWidth: 160
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const item = history.find(h => h.id === menuOpenId);
              if (!item) return null;
              
              const firstAppliedId = history.find(h => h.status === 'applied')?.id;
              const isVigente = item.id === firstAppliedId && item.status === 'applied';
              const canRestore = item.status === 'reverted' && firstAppliedId;
              
              return (
                <>
                  {canRestore && (
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        setMenuPosition(null);
                        setRestoreConfirmId(menuOpenId);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Restaurar versión
                    </button>
                  )}
                  {!isVigente && (
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        setMenuPosition(null);
                        setDeleteConfirmId(menuOpenId);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden p-3">

        {/* ===== HEADER CARD - MODO OSCURO ===== */}
        <div className="bg-slate-900 p-4 rounded-xl shadow-xl">
        {/* Top Row: Title + Close */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Valor Total del Inventario</p>
            <h1 className="text-4xl font-bold text-white tabular-nums tracking-tight">
              {formatCurrency(summary.total_value)}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Anterior: {formatCurrency(summary.previous_value)}</p>
            <div className={`text-2xl font-bold flex items-center justify-end gap-1 ${percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={percentChange >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
              </svg>
              {Math.abs(percentChange).toFixed(0)}%
            </div>
          </div>
          <button 
            onClick={handleDiscard}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors ml-4"
            title="Descartar valuación"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Row - Chips Oscuros */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Nuevos */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'new' ? 'all' : 'new')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all border ${
              activeFilter === 'new' 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            {counts.new} Nuevos
          </button>

          {/* Subieron */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'price_up' ? 'all' : 'price_up')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all border ${
              activeFilter === 'price_up' 
                ? 'bg-green-600 border-green-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            {counts.price_up} Subieron
            {summary.economic_impact_up > 0 && (
              <span className="text-green-400 ml-1">+{formatCompactCurrency(summary.economic_impact_up)}</span>
            )}
          </button>

          {/* Bajaron */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'price_down' ? 'all' : 'price_down')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all border ${
              activeFilter === 'price_down' 
                ? 'bg-amber-600 border-amber-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            {counts.price_down} Bajaron
          </button>

          {/* Sin cambios */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'unchanged' ? 'all' : 'unchanged')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all border ${
              activeFilter === 'unchanged' 
                ? 'bg-gray-600 border-gray-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            {counts.unchanged} Sin cambios
          </button>
        </div>
        </div>

        {/* ===== DATA TABLE - FONDO BLANCO ===== */}
        <div className="mt-3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden" style={{maxHeight: 'calc(100vh - 320px)'}}>
        {/* Table Header */}
        <div className="bg-gray-50 border-b border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 w-28">SKU</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 w-28 text-center">Cambio</th>
                <th className="px-4 py-3 w-28 text-right">Anterior</th>
                <th className="px-4 py-3 w-28 text-right">Nuevo</th>
                <th className="px-4 py-3 w-28 text-right">Diferencia</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable Table Body */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <tr
                  key={product.sku}
                  className="hover:bg-blue-50/50 transition-colors group"
                >
                  <td className="px-4 py-2.5 w-12">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.sku)}
                      onChange={() => toggleProductSelection(product.sku)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5 w-28">
                    <span className="font-mono text-sm text-gray-500">{product.sku}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-gray-900">{product.name}</span>
                  </td>
                  <td className="px-4 py-2.5 w-28 text-center">
                    {getChangeBadge(product.changeType)}
                  </td>
                  <td className="px-4 py-2.5 w-28 text-right">
                    <span className="text-sm text-gray-400 tabular-nums">
                      {product.oldPrice && product.oldPrice > 0 ? formatCurrency(product.oldPrice) : '–'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 w-28 text-right">
                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatCurrency(product.newPrice)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 w-28 text-right">
                    <span className={`text-sm font-semibold tabular-nums ${
                      product.difference > 0 ? 'text-emerald-600' : 
                      product.difference < 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {product.difference > 0 ? '+' : ''}{formatCurrency(product.difference)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No se encontraron productos con los filtros actuales.</p>
            </div>
          )}
          </div>
        </div>

        {/* ===== FOOTER BAR ===== */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            {showDetails ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
            {showDetails ? 'Ocultar Detalles' : 'Mostrar Detalles'}
          </button>
          
          <span className="text-gray-300">|</span>
          
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{selectedCount}</span> de {products.length} seleccionados
          </span>
        </div>
        
        <button
          onClick={handleApply}
          disabled={applying || selectedCount === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/25"
        >
          {applying ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Aplicando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Aplicar Todos los Cambios
            </>
          )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogView;
