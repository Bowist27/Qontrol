import React, { useState, useEffect, useRef } from 'react';
import { catalogApi, type ValuationSummary, type ImportHistoryItem } from '../../services/catalog.api';
import CatalogView from './CatalogView';

type ViewMode = 'list' | 'review';

const CatalogMainView: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingValuation, setPendingValuation] = useState<ValuationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [historyData, latestSummary] = await Promise.all([
        catalogApi.getImportHistory(20),
        catalogApi.getLatestValuationSummary().catch(() => null)
      ]);
      
      setHistory(historyData);
      
      // Check if there's a pending valuation
      if (latestSummary && latestSummary.id) {
        setPendingValuation(latestSummary);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleNewValuation = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      
      // Use analyzeReport to upload the file
      await catalogApi.analyzeReport(file);
      await loadData();
      
      // Go to review mode after successful upload
      setViewMode('review');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error uploading file');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReviewPending = () => {
    setViewMode('review');
  };

  const handleBackToList = () => {
    setViewMode('list');
    loadData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Aplicado</span>;
      case 'pending':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Pendiente</span>;
      case 'reverted':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Revertido</span>;
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  // If reviewing a valuation, show the CatalogView
  if (viewMode === 'review') {
    return (
      <div className="h-full flex flex-col">
        {/* Back button */}
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Volver al listado</span>
          </button>
        </div>
        <div className="flex-1">
          <CatalogView />
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo Maestro</h1>
          <p className="text-gray-500 mt-1">Gestiona las valuaciones de costos del inventario</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            onClick={handleNewValuation}
            disabled={uploading}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Subiendo...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva Valuación
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Pending valuation card */}
      {pendingValuation && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Valuación Pendiente de Revisión</h3>
                <p className="text-gray-600 text-sm mt-1">
                  {pendingValuation.new_products + pendingValuation.price_up + pendingValuation.price_down + pendingValuation.unchanged} productos · Valor total: {formatCurrency(pendingValuation.total_value)}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-blue-600">{pendingValuation.new_products} nuevos</span>
                  <span className="text-green-600">{pendingValuation.price_up} subieron</span>
                  <span className="text-amber-600">{pendingValuation.price_down} bajaron</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleReviewPending}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Revisar y Aplicar
            </button>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Historial de Valuaciones</h2>
        </div>
        
        {history.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-medium mb-1">No hay valuaciones</h3>
            <p className="text-gray-500 text-sm">Sube tu primera valuación para comenzar</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Archivo</th>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3 text-center">Productos</th>
                <th className="px-5 py-3 text-center">Cambios</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-900">{item.time_ago}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-700 font-medium">{item.file_name}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-600">{item.user}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-sm text-gray-900">{item.new_products + item.price_changes}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      {item.new_products > 0 && (
                        <span className="text-blue-600">+{item.new_products}</span>
                      )}
                      {item.price_changes > 0 && (
                        <span className="text-green-600">{item.price_changes} precios</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {item.status === 'pending' && (
                      <button
                        onClick={handleReviewPending}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Revisar →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CatalogMainView;
