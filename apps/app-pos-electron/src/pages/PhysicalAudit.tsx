/**
 * PhysicalAudit - Auditoría Física con escaneo rápido (Cloud-connected)
 * 
 * Se conecta a auditorías existentes del backend (creadas desde web-admin)
 * Los escaneos se envían en tiempo real al servidor
 * 
 * COMANDOS DE TECLADO:
 * - Escaneo normal: automático (1 unidad)
 * - F2: Modo cantidad - ingresa número y luego escanea
 * - F3: Deshacer último escaneo
 * - F7: Agregar producto manualmente (buscar por nombre, SKU o código)
 * - ESC: Salir del modo actual / Cancelar
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types from backend
interface RemoteAudit {
    session: {
        id: number;
        store_id: number;
        status: string;
        pdf_url?: string;
        created_at: string;
        created_by?: string;
    };
    store_name: string;
    total_items: number;
}

interface PhysicalScan {
    id: number;
    audit_id: number;
    barcode: string;
    sku?: string;
    product_name?: string;
    quantity: number;
    scanned_by?: string;
    device_id?: string;
    scanned_at: string;
    is_unknown: boolean;
}

interface ScanSummary {
    total_scans: number;
    total_quantity: number;
    unique_products: number;
    unknown_items: number;
    last_scan_at?: string;
}

type KeyboardMode = 'SCAN' | 'QUANTITY_INPUT' | 'QUANTITY_READY' | 'MANUAL_INPUT' | 'MANUAL_QTY';

interface LocalProduct {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    last_price: number | null;
}

interface PhysicalAuditProps {
    onBack: () => void;
}

// Use environment variable or default (env var does NOT include /api suffix)
const AUDIT_API = `${import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:8085'}/api`;

export const PhysicalAudit: React.FC<PhysicalAuditProps> = ({ onBack }) => {
    // Connection state
    const [activeAudits, setActiveAudits] = useState<RemoteAudit[]>([]);
    const [selectedAudit, setSelectedAudit] = useState<RemoteAudit | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    
    // Scan state
    const [scans, setScans] = useState<PhysicalScan[]>([]);
    const [summary, setSummary] = useState<ScanSummary | null>(null);
    
    // UI state
    const [mode, setMode] = useState<KeyboardMode>('SCAN');
    const [pendingQuantity, setPendingQuantity] = useState<string>('');
    const [lastScan, setLastScan] = useState<{ product?: string; quantity: number; isUnknown?: boolean } | null>(null);
    const [barcodeBuffer, setBarcodeBuffer] = useState<string>('');
    const [isSending, setIsSending] = useState(false);

    // Manual input state
    const [manualQuery, setManualQuery] = useState<string>('');
    const [manualResults, setManualResults] = useState<LocalProduct[]>([]);
    const [manualSelectedIndex, setManualSelectedIndex] = useState<number>(0);
    const [isSearching, setIsSearching] = useState(false);
    const [manualSelectedProduct, setManualSelectedProduct] = useState<LocalProduct | null>(null);
    const [manualQty, setManualQty] = useState<string>('1');
    const manualInputRef = useRef<HTMLInputElement>(null);
    const manualQtyInputRef = useRef<HTMLInputElement>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Device info
    const [deviceId] = useState(() => `POS-${Date.now().toString(36).toUpperCase()}`);
    const [userName, setUserName] = useState<string>('');
    
    // Refs
    const lastScanTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch active audits from backend
    const fetchActiveAudits = async () => {
        try {
            setIsConnecting(true);
            setConnectionError(null);
            const response = await fetch(`${AUDIT_API}/audits/active`);
            if (!response.ok) throw new Error('Error de conexión');
            const data = await response.json();
            setActiveAudits(data.audits || []);
        } catch (err) {
            setConnectionError('No se pudo conectar al servidor');
            console.error('Failed to fetch audits:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    // Fetch scans for selected audit
    const fetchScans = async (auditId: number) => {
        try {
            const [scansRes, summaryRes] = await Promise.all([
                fetch(`${AUDIT_API}/audits/${auditId}/scans`),
                fetch(`${AUDIT_API}/audits/${auditId}/scans/summary`)
            ]);
            
            if (scansRes.ok) {
                const data = await scansRes.json();
                setScans(data.scans || []);
            }
            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setSummary(data);
            }
        } catch (err) {
            console.error('Failed to fetch scans:', err);
        }
    };

    // Load audits on mount
    useEffect(() => {
        fetchActiveAudits();
        
        // Get current user name from window.users if available
        if (typeof window !== 'undefined' && (window as any).users?.getCurrentUser) {
            (window as any).users.getCurrentUser().then((user: { name: string } | null) => {
                if (user) setUserName(user.name);
            }).catch(() => {});
        }
    }, []);

    // Poll for updates when connected to an audit
    useEffect(() => {
        if (selectedAudit) {
            fetchScans(selectedAudit.session.id);
            
            // Poll every 5 seconds for updates (in case web-admin modifies something)
            pollInterval.current = setInterval(() => {
                fetchScans(selectedAudit.session.id);
            }, 5000);
        }
        
        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [selectedAudit]);

    // Send scan to backend
    const sendScan = useCallback(async (barcode: string, quantity: number) => {
        if (!selectedAudit) return;
        
        setIsSending(true);
        try {
            const response = await fetch(`${AUDIT_API}/audits/${selectedAudit.session.id}/scans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    quantity,
                    scanned_by: userName || undefined,
                    device_id: deviceId
                })
            });

            if (!response.ok) {
                throw new Error('Error al enviar escaneo');
            }

            const data = await response.json();
            const newScan = data.scan as PhysicalScan;
            
            // Add to local state immediately
            setScans(prev => [newScan, ...prev]);
            
            // Update summary
            setSummary(prev => prev ? {
                ...prev,
                total_scans: prev.total_scans + 1,
                total_quantity: prev.total_quantity + quantity,
                unique_products: newScan.is_unknown ? prev.unique_products : prev.unique_products + (scans.some(s => s.sku === newScan.sku) ? 0 : 1),
                unknown_items: newScan.is_unknown ? prev.unknown_items + 1 : prev.unknown_items
            } : {
                total_scans: 1,
                total_quantity: quantity,
                unique_products: newScan.is_unknown ? 0 : 1,
                unknown_items: newScan.is_unknown ? 1 : 0
            });

            // Show feedback
            setLastScan({
                product: newScan.product_name || barcode,
                quantity: newScan.quantity,
                isUnknown: newScan.is_unknown
            });

            // Clear feedback after 2s
            if (lastScanTimeout.current) clearTimeout(lastScanTimeout.current);
            lastScanTimeout.current = setTimeout(() => setLastScan(null), 2000);

        } catch (err) {
            console.error('Scan failed:', err);
            setLastScan({ product: '❌ Error al enviar', quantity: 0 });
        } finally {
            setIsSending(false);
        }
    }, [selectedAudit, userName, deviceId, scans]);

    // Search local products for manual input
    const searchLocalProducts = useCallback(async (query: string) => {
        if (query.length < 2) {
            setManualResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const results = await (window as Window & { products: { search: (q: string) => Promise<LocalProduct[]> } }).products.search(query);
            setManualResults(results || []);
            setManualSelectedIndex(0);
        } catch (err) {
            console.error('Product search failed:', err);
            setManualResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Handle manual product selection → go to quantity input
    const handleManualSelect = useCallback((product: LocalProduct) => {
        setManualSelectedProduct(product);
        setManualQty('1');
        setMode('MANUAL_QTY');
        setTimeout(() => {
            manualQtyInputRef.current?.focus();
            manualQtyInputRef.current?.select();
        }, 50);
    }, []);

    // Confirm manual product with quantity
    const confirmManualProduct = useCallback(() => {
        if (!manualSelectedProduct) return;
        const barcode = manualSelectedProduct.barcode || manualSelectedProduct.sku;
        const quantity = parseFloat(manualQty) || 1;
        sendScan(barcode, quantity);
        // Reset all manual state
        setMode('SCAN');
        setManualQuery('');
        setManualResults([]);
        setManualSelectedIndex(0);
        setManualSelectedProduct(null);
        setManualQty('1');
    }, [sendScan, manualSelectedProduct, manualQty]);

    // Handle undo (delete last scan)
    const handleUndo = useCallback(async () => {
        if (!selectedAudit) return;
        
        try {
            const response = await fetch(`${AUDIT_API}/audits/${selectedAudit.session.id}/scans/last`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                setScans(prev => prev.slice(1));
                fetchScans(selectedAudit.session.id); // Refresh summary
                setLastScan({ product: '↩️ DESHACER', quantity: 0 });
                if (lastScanTimeout.current) clearTimeout(lastScanTimeout.current);
                lastScanTimeout.current = setTimeout(() => setLastScan(null), 1500);
            }
        } catch (err) {
            console.error('Undo failed:', err);
        }
    }, [selectedAudit]);

    // Keyboard event handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if we're connected to an audit
            if (!selectedAudit) return;
            
            // Prevent default for function keys
            if (e.key.startsWith('F') && e.key.length <= 3) {
                e.preventDefault();
            }

            // F2: Quantity mode
            if (e.key === 'F2') {
                // Clear any pending barcode first
                if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
                setBarcodeBuffer('');
                setMode('QUANTITY_INPUT');
                setPendingQuantity('');
                return;
            }

            // F3: Undo
            if (e.key === 'F3') {
                handleUndo();
                return;
            }

            // F7: Manual product input
            if (e.key === 'F7') {
                if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
                setBarcodeBuffer('');
                setMode('MANUAL_INPUT');
                setManualQuery('');
                setManualResults([]);
                setManualSelectedIndex(0);
                setTimeout(() => manualInputRef.current?.focus(), 50);
                return;
            }

            // ESC: Cancel mode
            if (e.key === 'Escape') {
                setMode('SCAN');
                setPendingQuantity('');
                setBarcodeBuffer('');
                setManualQuery('');
                setManualResults([]);
                setManualSelectedProduct(null);
                setManualQty('1');
                return;
            }

            // In MANUAL_INPUT or MANUAL_QTY mode, let the input field handle everything
            if (mode === 'MANUAL_INPUT' || mode === 'MANUAL_QTY') {
                return;
            }

            // In QUANTITY_INPUT mode, handle number input (user typing quantity)
            if (mode === 'QUANTITY_INPUT') {
                if (e.key >= '0' && e.key <= '9') {
                    setPendingQuantity(prev => prev + e.key);
                    return;
                }
                if (e.key === 'Backspace') {
                    setPendingQuantity(prev => prev.slice(0, -1));
                    return;
                }
                if (e.key === '.') {
                    if (!pendingQuantity.includes('.')) {
                        setPendingQuantity(prev => prev + '.');
                    }
                    return;
                }
                // Enter confirms quantity and switches to waiting for barcode
                if (e.key === 'Enter' && pendingQuantity) {
                    setMode('QUANTITY_READY');
                    return;
                }
                // Any other key is ignored in this mode
                return;
            }

            // Barcode scanning (alphanumeric input from scanner)
            // Works in SCAN mode or QUANTITY_READY (after user confirmed quantity)
            if (mode === 'SCAN' || mode === 'QUANTITY_READY') {
                if (/^[a-zA-Z0-9]$/.test(e.key)) {
                    setBarcodeBuffer(prev => {
                        const newBuffer = prev + e.key;
                        
                        // Reset timeout
                        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
                        barcodeTimeout.current = setTimeout(() => {
                            if (newBuffer.length >= 3) {
                                const quantity = mode === 'QUANTITY_READY' && pendingQuantity 
                                    ? parseFloat(pendingQuantity) 
                                    : 1;
                                sendScan(newBuffer, quantity);
                                setMode('SCAN');
                                setPendingQuantity('');
                            }
                            setBarcodeBuffer('');
                        }, 100);
                        
                        return newBuffer;
                    });
                }
                
                // Enter also triggers scan (some scanners send enter at end)
                if (e.key === 'Enter' && barcodeBuffer.length >= 3) {
                    if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
                    const quantity = mode === 'QUANTITY_READY' && pendingQuantity 
                        ? parseFloat(pendingQuantity) 
                        : 1;
                    sendScan(barcodeBuffer, quantity);
                    setBarcodeBuffer('');
                    setMode('SCAN');
                    setPendingQuantity('');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedAudit, mode, pendingQuantity, barcodeBuffer, sendScan, handleUndo, searchLocalProducts, confirmManualProduct]);

    // Select an audit to connect to
    const handleSelectAudit = (audit: RemoteAudit) => {
        setSelectedAudit(audit);
        setScans([]);
        setSummary(null);
    };

    // Disconnect from audit
    const handleDisconnect = () => {
        setSelectedAudit(null);
        setScans([]);
        setSummary(null);
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
        }
    };

    // ==================== RENDER ====================

    // Show audit selection screen if not connected
    if (!selectedAudit) {
        return (
            <div className="flex flex-col h-screen bg-slate-900 text-white">
                {/* Header */}
                <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="text-slate-400 hover:text-white text-2xl">
                            ←
                        </button>
                        <h1 className="text-xl font-bold">Auditoría Física</h1>
                    </div>
                    <button 
                        onClick={fetchActiveAudits}
                        disabled={isConnecting}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-xl"
                    >
                        {isConnecting ? 'Buscando...' : '🔄 Actualizar'}
                    </button>
                </div>

                {/* Device Info */}
                <div className="bg-slate-800/50 px-6 py-3 text-sm text-slate-400 flex items-center gap-4">
                    <span>📱 Dispositivo: <strong className="text-white">{deviceId}</strong></span>
                    {userName && <span>👤 Usuario: <strong className="text-white">{userName}</strong></span>}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {connectionError && (
                        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-4">
                            {connectionError}
                        </div>
                    )}

                    {activeAudits.length === 0 && !isConnecting && !connectionError && (
                        <div className="text-center py-20 text-slate-500">
                            <div className="text-6xl mb-4">📋</div>
                            <div className="text-xl">No hay auditorías activas</div>
                            <div className="text-sm mt-2">
                                Crea una auditoría desde el panel web para comenzar
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4">
                        {activeAudits.map(audit => (
                            <button
                                key={audit.session.id}
                                onClick={() => handleSelectAudit(audit)}
                                className="bg-slate-800 hover:bg-slate-700 p-6 rounded-xl text-left transition-all border-2 border-transparent hover:border-blue-500"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold">{audit.store_name}</h2>
                                        <div className="text-slate-400 text-sm mt-1">
                                            Creada: {new Date(audit.session.created_at).toLocaleString()}
                                        </div>
                                        <div className="text-slate-400 text-sm">
                                            Estado: <span className={`font-medium ${
                                                audit.session.status === 'IN_PROGRESS' ? 'text-blue-400' :
                                                audit.session.status === 'COUNTING' ? 'text-amber-400' :
                                                'text-slate-400'
                                            }`}>{audit.session.status}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-blue-400">{audit.total_items}</div>
                                        <div className="text-slate-400 text-sm">items teóricos</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Connected to an audit - show scanning interface
    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{selectedAudit.store_name}</h1>
                        <div className="text-slate-400 text-sm flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Conectado • {deviceId}
                        </div>
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl"
                    >
                        ✕ Desconectar
                    </button>
                </div>
            </div>

            {/* Mode indicator - MANUAL_QTY (quantity after selecting product) */}
            {mode === 'MANUAL_QTY' && manualSelectedProduct && (
                <div className="bg-orange-600 px-6 py-4">
                    <div className="text-sm font-medium text-orange-200 mb-1">PRODUCTO SELECCIONADO</div>
                    <div className="text-lg font-bold mb-3">{manualSelectedProduct.name}
                        <span className="text-orange-200 text-sm font-normal ml-3">SKU: {manualSelectedProduct.sku}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="text-orange-100 font-medium">¿Cuántas piezas?</label>
                        <input
                            ref={manualQtyInputRef}
                            type="number"
                            min="1"
                            step="1"
                            value={manualQty}
                            onChange={(e) => setManualQty(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    confirmManualProduct();
                                } else if (e.key === 'Escape') {
                                    // Go back to search
                                    setMode('MANUAL_INPUT');
                                    setManualSelectedProduct(null);
                                    setTimeout(() => manualInputRef.current?.focus(), 50);
                                }
                            }}
                            className="w-32 px-4 py-3 bg-slate-800 text-white text-2xl font-bold text-center rounded-xl border-2 border-orange-400 focus:border-orange-200 focus:outline-none"
                            autoFocus
                        />
                        <button
                            onClick={confirmManualProduct}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-lg transition-colors"
                        >
                            ✓ Confirmar
                        </button>
                    </div>
                    <div className="mt-2 text-xs text-orange-300/60 flex gap-4">
                        <span><kbd className="bg-orange-800 px-1.5 py-0.5 rounded">Enter</kbd> Confirmar</span>
                        <span><kbd className="bg-orange-800 px-1.5 py-0.5 rounded">ESC</kbd> Volver a buscar</span>
                    </div>
                </div>
            )}

            {/* Mode indicator - MANUAL_INPUT */}
            {mode === 'MANUAL_INPUT' && (
                <div className="bg-cyan-700 px-6 py-4">
                    <div className="text-sm font-medium text-cyan-200 mb-2">🔍 BÚSQUEDA MANUAL — Escribe nombre, SKU o código de barras</div>
                    <div className="relative">
                        <input
                            ref={manualInputRef}
                            type="text"
                            value={manualQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setManualQuery(val);
                                if (searchTimeout.current) clearTimeout(searchTimeout.current);
                                searchTimeout.current = setTimeout(() => searchLocalProducts(val), 200);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setManualSelectedIndex(prev => Math.min(prev + 1, manualResults.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setManualSelectedIndex(prev => Math.max(prev - 1, 0));
                                } else if (e.key === 'Enter' && manualResults.length > 0) {
                                    e.preventDefault();
                                    handleManualSelect(manualResults[manualSelectedIndex]);
                                } else if (e.key === 'Escape') {
                                    setMode('SCAN');
                                    setManualQuery('');
                                    setManualResults([]);
                                }
                            }}
                            placeholder="Ej: Aceite, 7501000, SKU001..."
                            className="w-full px-4 py-3 bg-slate-800 text-white text-lg rounded-xl border-2 border-cyan-500 focus:border-cyan-300 focus:outline-none placeholder-slate-500"
                            autoFocus
                        />
                        {isSearching && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-300 text-sm">Buscando...</div>
                        )}
                    </div>
                    {/* Search Results */}
                    {manualResults.length > 0 && (
                        <div className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-800 border border-slate-600">
                            {manualResults.map((product, idx) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleManualSelect(product)}
                                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors
                                        ${idx === manualSelectedIndex ? 'bg-cyan-600/40 text-white' : 'text-slate-300 hover:bg-slate-700'}
                                        ${idx > 0 ? 'border-t border-slate-700' : ''}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{product.name}</div>
                                        <div className="text-sm text-slate-400 flex gap-3">
                                            <span>SKU: {product.sku}</span>
                                            {product.barcode && <span>CB: {product.barcode}</span>}
                                            <span className="text-slate-500">{product.unit}</span>
                                        </div>
                                    </div>
                                    <div className="ml-3 text-cyan-400 text-sm font-medium">↵ Seleccionar</div>
                                </button>
                            ))}
                        </div>
                    )}
                    {manualQuery.length >= 2 && manualResults.length === 0 && !isSearching && (
                        <div className="mt-2 text-center py-4 text-slate-400 bg-slate-800/50 rounded-xl">
                            No se encontraron productos para "{manualQuery}"
                        </div>
                    )}
                    <div className="mt-2 text-xs text-cyan-300/60 flex gap-4">
                        <span><kbd className="bg-cyan-800 px-1.5 py-0.5 rounded">↑↓</kbd> Navegar</span>
                        <span><kbd className="bg-cyan-800 px-1.5 py-0.5 rounded">Enter</kbd> Seleccionar</span>
                        <span><kbd className="bg-cyan-800 px-1.5 py-0.5 rounded">ESC</kbd> Cancelar</span>
                    </div>
                </div>
            )}

            {/* Mode indicator - QUANTITY_INPUT */}
            {mode === 'QUANTITY_INPUT' && (
                <div className="bg-purple-600 px-6 py-4 text-center">
                    <div className="text-lg font-bold">
                        INGRESA CANTIDAD: {pendingQuantity || '_'}
                    </div>
                    <div className="text-purple-200 text-sm">
                        Escribe la cantidad y presiona <kbd className="bg-purple-800 px-2 py-0.5 rounded mx-1">Enter</kbd> para confirmar
                    </div>
                </div>
            )}

            {/* Mode indicator - QUANTITY_READY */}
            {mode === 'QUANTITY_READY' && (
                <div className="bg-green-600 px-6 py-4 text-center">
                    <div className="text-lg font-bold">
                        ✓ CANTIDAD: {pendingQuantity} — ESCANEA EL PRODUCTO
                    </div>
                    <div className="text-green-200 text-sm">
                        Escanea el código de barras del producto
                    </div>
                </div>
            )}

            {/* Last scan feedback */}
            {lastScan && (
                <div className={`px-6 py-4 text-center transition-all ${
                    lastScan.isUnknown ? 'bg-amber-600' : 
                    lastScan.quantity === 0 ? 'bg-slate-600' : 'bg-emerald-600'
                }`}>
                    <div className="text-2xl font-bold">
                        {lastScan.quantity > 0 && `+${lastScan.quantity} `}
                        {lastScan.product}
                    </div>
                    {lastScan.isUnknown && (
                        <div className="text-amber-200 text-sm">⚠️ Producto no encontrado en catálogo</div>
                    )}
                </div>
            )}

            {/* Sending indicator */}
            {isSending && (
                <div className="bg-blue-600 px-6 py-2 text-center text-sm">
                    Enviando...
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-800/50">
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-400">{summary?.total_scans || 0}</div>
                    <div className="text-slate-400 text-sm">Escaneos</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-400">{summary?.total_quantity || 0}</div>
                    <div className="text-slate-400 text-sm">Unidades</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">{summary?.unique_products || 0}</div>
                    <div className="text-slate-400 text-sm">Productos</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className={`text-3xl font-bold ${(summary?.unknown_items || 0) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {summary?.unknown_items || 0}
                    </div>
                    <div className="text-slate-400 text-sm">No encontrados</div>
                </div>
            </div>

            {/* Keyboard shortcuts */}
            <div className="flex items-center justify-center gap-6 py-3 bg-slate-800/30 text-sm">
                <span className="text-slate-500">
                    <kbd className="bg-slate-700 px-2 py-1 rounded">F2</kbd> Cantidad
                </span>
                <span className="text-slate-500">
                    <kbd className="bg-slate-700 px-2 py-1 rounded">F3</kbd> Deshacer
                </span>
                <span className="text-slate-500">
                    <kbd className="bg-slate-700 px-2 py-1 rounded">F7</kbd> Manual
                </span>
                <span className="text-slate-500">
                    <kbd className="bg-slate-700 px-2 py-1 rounded">ESC</kbd> Cancelar
                </span>
            </div>

            {/* Scan List (grouped by product) */}
            <div className="flex-1 overflow-auto p-4">
                <div className="space-y-2">
                    {(() => {
                        // Group scans by SKU/barcode
                        const grouped = scans.reduce<Record<string, { key: string; product_name: string; sku: string; barcode: string; quantity: number; is_unknown: boolean; lastId: number }>>((acc, scan) => {
                            const key = scan.sku || scan.barcode;
                            if (acc[key]) {
                                acc[key].quantity += scan.quantity;
                                acc[key].lastId = Math.max(acc[key].lastId, scan.id);
                            } else {
                                acc[key] = {
                                    key,
                                    product_name: scan.product_name || scan.barcode,
                                    sku: scan.sku || '',
                                    barcode: scan.barcode,
                                    quantity: scan.quantity,
                                    is_unknown: scan.is_unknown,
                                    lastId: scan.id,
                                };
                            }
                            return acc;
                        }, {});
                        const items = Object.values(grouped).sort((a, b) => b.lastId - a.lastId);
                        return items.map((item, index) => (
                            <div 
                                key={item.key}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl
                                    ${index === 0 ? 'bg-slate-700 ring-2 ring-blue-500' : 'bg-slate-800'}
                                    ${item.is_unknown ? 'border-l-4 border-amber-500' : ''}`}
                            >
                                <div className="flex-1">
                                    <div className="font-medium">
                                        {item.product_name}
                                    </div>
                                    <div className="text-slate-400 text-sm">
                                        {item.sku ? `SKU: ${item.sku}` : 'Código: ' + item.barcode}
                                        {item.is_unknown ? ' ⚠️' : ''}
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-blue-400 ml-4">
                                    ×{item.quantity}
                                </div>
                            </div>
                        ));
                    })()}

                    {scans.length === 0 && (
                        <div className="text-center py-20 text-slate-500">
                            <div className="text-6xl mb-4">📦</div>
                            <div className="text-xl">Esperando escaneos...</div>
                            <div className="text-sm mt-2">Usa la pistola Zebra o presiona <kbd className="bg-slate-700 px-2 py-0.5 rounded">F7</kbd> para agregar manualmente</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PhysicalAudit;
