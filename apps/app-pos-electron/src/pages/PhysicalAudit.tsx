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
import { useAuth } from '../context/AuthContext';
import type { ProductsAPI } from '../declarations';

// Types from backend
interface RemoteAudit {
    session: {
        id: number;
        store_id: number;
        name?: string;
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

type KeyboardMode = 'SCAN' | 'QUANTITY_INPUT' | 'QUANTITY_READY' | 'MANUAL_INPUT' | 'MANUAL_QTY' | 'REGISTER_PRODUCT' | 'MODIFY_SEARCH' | 'MODIFY_QTY';

interface LocalProduct {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    last_price: number | null;
}

interface Store {
    id: number;
    name: string;
    status: boolean;
    zone_id?: number | null;
    zone_name?: string | null;
}

interface PhysicalAuditProps {
    onBack: () => void;
}

// Use environment variable or default (env var does NOT include /api suffix)
const AUDIT_API = `${import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:8085'}/api`;

export const PhysicalAudit: React.FC<PhysicalAuditProps> = ({ onBack }) => {
    // Auth context for store-based filtering
    const { user } = useAuth();
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
    const [flashColor, setFlashColor] = useState<'green' | 'red' | 'amber' | null>(null);

    // Undo confirmation state
    const [undoConfirm, setUndoConfirm] = useState<{ scan: PhysicalScan; step: 'confirm' } | null>(null);
    const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Register unknown product state
    const [registerBarcode, setRegisterBarcode] = useState<string>('');
    const [registerSku, setRegisterSku] = useState<string>('');
    const [registerName, setRegisterName] = useState<string>('');
    const [registerUnit, setRegisterUnit] = useState<string>('pz');
    const [registerPrice, setRegisterPrice] = useState<string>('');
    const [registerQty, setRegisterQty] = useState<number>(1);
    const [registerFromScan, setRegisterFromScan] = useState<boolean>(false);
    const registerSkuRef = useRef<HTMLInputElement>(null);

    // Modify quantity state (F4)
    const [modifyQuery, setModifyQuery] = useState<string>('');
    const [modifyResults, setModifyResults] = useState<LocalProduct[]>([]);
    const [modifySelectedIndex, setModifySelectedIndex] = useState<number>(0);
    const [modifyProduct, setModifyProduct] = useState<{ barcode: string; sku: string; name: string; currentQty: number } | null>(null);
    const [modifyNewQty, setModifyNewQty] = useState<string>('');
    const modifyInputRef = useRef<HTMLInputElement>(null);
    const modifyQtyInputRef = useRef<HTMLInputElement>(null);

    // Finalize state
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isFinalized, setIsFinalized] = useState(false);

    // Create audit state
    const [showCreateAudit, setShowCreateAudit] = useState(false);
    const [stores, setStores] = useState<Store[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(false);
    const [isCreatingAudit, setIsCreatingAudit] = useState(false);
    const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
    const [expandedZone, setExpandedZone] = useState<string | null>(null);
    const [newAuditName, setNewAuditName] = useState('');

    // Reopen request state
    const [finalizedAudits, setFinalizedAudits] = useState<RemoteAudit[]>([]);
    const [showReopenDialog, setShowReopenDialog] = useState<RemoteAudit | null>(null);
    const [reopenReason, setReopenReason] = useState('');
    const [isRequestingReopen, setIsRequestingReopen] = useState(false);
    const [reopenSuccess, setReopenSuccess] = useState<string | null>(null);

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
            let allAudits: RemoteAudit[] = data.audits || [];

            // Filter by user's assigned stores (admin/gerente with no stores = see none)
            const userStores = user?.store_ids || [];
            const isAdmin = user?.role_name === 'Administrador';
            if (!isAdmin && userStores.length > 0) {
                allAudits = allAudits.filter(a => userStores.includes(a.session.store_id));
            } else if (!isAdmin && userStores.length === 0) {
                allAudits = [];
            }

            // Split into active and finalized
            setActiveAudits(allAudits.filter(a => a.session.status !== 'finalizado'));
            setFinalizedAudits(allAudits.filter(a => a.session.status === 'finalizado'));
        } catch (err) {
            setConnectionError('No se pudo conectar al servidor');
            console.error('Failed to fetch audits:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    // Fetch stores for creating new audit (filtered by user's stores)
    const fetchStores = async () => {
        setIsLoadingStores(true);
        try {
            const response = await fetch(`${AUDIT_API}/pos/stores`);
            if (!response.ok) throw new Error('Error fetching stores');
            const data = await response.json();
            let allStores: Store[] = data.stores || [];

            // Filter by user's assigned stores
            const userStores = user?.store_ids || [];
            const isAdmin = user?.role_name === 'Administrador';
            if (!isAdmin && userStores.length > 0) {
                allStores = allStores.filter(s => userStores.includes(s.id));
            } else if (!isAdmin) {
                allStores = [];
            }

            setStores(allStores);
        } catch (err) {
            console.error('Failed to fetch stores:', err);
        } finally {
            setIsLoadingStores(false);
        }
    };

    // Create new audit from POS
    const handleCreateAudit = async () => {
        if (!selectedStoreId) return;
        setIsCreatingAudit(true);
        try {
            const response = await fetch(`${AUDIT_API}/pos/audits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: selectedStoreId,
                    device_id: deviceId,
                    created_by: user?.id || null,
                    name: newAuditName || undefined,
                })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Error al crear auditoría');
            }
            // Refresh audits list to include the new one
            await fetchActiveAudits();
            setShowCreateAudit(false);
            setSelectedStoreId(null);
            setNewAuditName('');
        } catch (err) {
            console.error('Failed to create audit:', err);
            setConnectionError(err instanceof Error ? err.message : 'Error al crear auditoría');
        } finally {
            setIsCreatingAudit(false);
        }
    };

    // Request reopen of finalized audit
    const handleRequestReopen = async (audit: RemoteAudit) => {
        setIsRequestingReopen(true);
        try {
            const response = await fetch(`${AUDIT_API}/pos/audits/${audit.session.id}/reopen-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: deviceId,
                    requested_by: user?.id || deviceId,
                    reason: reopenReason,
                })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Error al solicitar reapertura');
            }
            setShowReopenDialog(null);
            setReopenReason('');
            setReopenSuccess(`Solicitud de reapertura enviada para "${audit.store_name}". El administrador será notificado.`);
            setTimeout(() => setReopenSuccess(null), 5000);
        } catch (err) {
            console.error('Failed to request reopen:', err);
            setConnectionError(err instanceof Error ? err.message : 'Error al solicitar reapertura');
        } finally {
            setIsRequestingReopen(false);
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

        // Set username from auth context
        if (user) {
            setUserName(`${user.first_name} ${user.last_name}`.trim() || user.email);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

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
                    scanned_by: user?.id || undefined,
                    device_id: deviceId
                })
            });

            if (!response.ok) {
                throw new Error('Error al enviar escaneo');
            }

            const data = await response.json();
            const newScan = data.scan as PhysicalScan;

            // If unknown product, prompt registration
            if (newScan.is_unknown) {
                // Add to local state immediately
                setScans(prev => [newScan, ...prev]);
                setSummary(prev => prev ? {
                    ...prev,
                    total_scans: prev.total_scans + 1,
                    total_quantity: prev.total_quantity + quantity,
                    unique_products: prev.unique_products,
                    unknown_items: prev.unknown_items + 1
                } : {
                    total_scans: 1,
                    total_quantity: quantity,
                    unique_products: 0,
                    unknown_items: 1
                });

                // Enter registration mode
                setRegisterBarcode(barcode);
                setRegisterSku(barcode); // Pre-fill SKU with barcode
                setRegisterName('');
                setRegisterUnit('pz');
                setRegisterPrice('');
                setRegisterQty(quantity);
                setRegisterFromScan(true);
                setMode('REGISTER_PRODUCT');
                setFlashColor('amber');
                setTimeout(() => {
                    setFlashColor(null);
                    registerSkuRef.current?.focus();
                    registerSkuRef.current?.select();
                }, 400);
                return;
            }

            // Add to local state immediately
            setScans(prev => [newScan, ...prev]);

            // Update summary (known product)
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

            // Flash feedback
            setFlashColor(newScan.is_unknown ? 'amber' : 'green');
            setTimeout(() => setFlashColor(null), 400);

            // Clear feedback after 2s
            if (lastScanTimeout.current) clearTimeout(lastScanTimeout.current);
            lastScanTimeout.current = setTimeout(() => setLastScan(null), 2000);

        } catch (err) {
            console.error('Scan failed:', err);
            setLastScan({ product: '❌ Error al enviar', quantity: 0 });
            setFlashColor('red');
            setTimeout(() => setFlashColor(null), 400);
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

    // Confirm registration of unknown product → save to local DB
    const confirmRegisterProduct = useCallback(async () => {
        if (!registerSku || !registerBarcode) return;
        const productData = {
            sku: registerSku.trim(),
            barcode: registerBarcode.trim(),
            name: registerName.trim() || registerSku.trim(),
            unit: registerUnit.trim() || 'pz',
            last_price: registerPrice ? parseFloat(registerPrice) : null
        };
        try {
            // 1. Save to local SQLite (instant offline access)
            const productAPI = (window as Window & { products: ProductsAPI }).products;
            const localResult = await productAPI.create(productData);

            // 2. Also save to backend PostgreSQL (so web-admin sees it)
            try {
                await fetch(`${AUDIT_API}/pos/catalog/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sku: productData.sku,
                        name: productData.name,
                        barcode: productData.barcode,
                        unit: productData.unit,
                        price: productData.last_price || 0
                    })
                });
            } catch (backendErr) {
                console.warn('Backend catalog sync failed (product saved locally):', backendErr);
            }

            if (localResult.success) {
                // If registered from manual search (not from scan), also send the scan to count it
                if (!registerFromScan && selectedAudit) {
                    try {
                        await sendScan(productData.barcode || productData.sku, registerQty);
                    } catch (scanErr) {
                        console.warn('Auto-scan after register failed:', scanErr);
                    }
                }
                // Refresh scan list immediately so product names resolve and new scans appear
                if (selectedAudit) {
                    fetchScans(selectedAudit.session.id);
                }
                setLastScan({ product: `✓ REGISTRADO: ${productData.name}`, quantity: registerQty });
                setFlashColor('green');
                setTimeout(() => setFlashColor(null), 400);
            } else {
                setLastScan({ product: `❌ Error: ${localResult.error}`, quantity: 0 });
                setFlashColor('red');
                setTimeout(() => setFlashColor(null), 400);
            }
        } catch (err) {
            console.error('Register product failed:', err);
            setLastScan({ product: '❌ Error al registrar', quantity: 0 });
            setFlashColor('red');
            setTimeout(() => setFlashColor(null), 400);
        }
        // Clear feedback after 2s
        if (lastScanTimeout.current) clearTimeout(lastScanTimeout.current);
        lastScanTimeout.current = setTimeout(() => setLastScan(null), 2000);
        // Reset state
        setMode('SCAN');
        setRegisterBarcode('');
        setRegisterSku('');
        setRegisterName('');
        setRegisterUnit('pz');
        setRegisterPrice('');
    }, [registerSku, registerBarcode, registerName, registerUnit, registerPrice, registerQty, registerFromScan, selectedAudit, sendScan]);

    // Handle undo (delete last scan) — two-step confirmation
    const handleUndoStep1 = useCallback(() => {
        if (!selectedAudit || scans.length === 0) return;
        // Get the most recent individual scan (first in list, sorted by newest)
        const lastScanItem = scans[0];
        if (!lastScanItem) return;

        // Show confirmation with product details
        setUndoConfirm({ scan: lastScanItem, step: 'confirm' });

        // Auto-cancel after 8 seconds
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        undoTimeout.current = setTimeout(() => setUndoConfirm(null), 8000);
    }, [selectedAudit, scans]);

    const handleUndoConfirm = useCallback(async () => {
        if (!selectedAudit || !undoConfirm) return;

        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        setUndoConfirm(null);

        try {
            const response = await fetch(`${AUDIT_API}/audits/${selectedAudit.session.id}/scans/last`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const deleted = undoConfirm.scan;
                setScans(prev => prev.slice(1));
                fetchScans(selectedAudit.session.id);
                setLastScan({ product: `↩️ ELIMINADO: ${deleted.product_name || deleted.barcode} (×${deleted.quantity})`, quantity: 0 });
                setFlashColor('amber');
                setTimeout(() => setFlashColor(null), 300);
                if (lastScanTimeout.current) clearTimeout(lastScanTimeout.current);
                lastScanTimeout.current = setTimeout(() => setLastScan(null), 3000);
            }
        } catch (err) {
            console.error('Undo failed:', err);
        }
    }, [selectedAudit, undoConfirm]);

    const handleUndoCancel = useCallback(() => {
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        setUndoConfirm(null);
    }, []);

    // ===== F4: Modify quantity flow =====
    const handleModifySearch = useCallback(async (query: string) => {
        if (query.length < 2) { setModifyResults([]); return; }
        try {
            const searchResults = await (window as Window & { products: { search: (q: string) => Promise<LocalProduct[]> } }).products.search(query);
            setModifyResults(searchResults || []);
            setModifySelectedIndex(0);
        } catch { setModifyResults([]); }
    }, []);

    const handleModifySelectProduct = useCallback((product: LocalProduct) => {
        // Find current quantity from scans
        const currentQty = scans
            .filter(s => s.barcode === product.barcode || s.sku === product.sku)
            .reduce((sum, s) => sum + s.quantity, 0);

        setModifyProduct({
            barcode: product.barcode || '',
            sku: product.sku,
            name: product.name,
            currentQty
        });
        setModifyNewQty(currentQty > 0 ? String(currentQty) : '');
        setMode('MODIFY_QTY');
        setTimeout(() => modifyQtyInputRef.current?.focus(), 50);
    }, [scans]);

    const handleModifyFromBarcode = useCallback((barcode: string) => {
        // Find product in scans or local DB
        const existingScan = scans.find(s => s.barcode === barcode);
        const currentQty = scans
            .filter(s => s.barcode === barcode)
            .reduce((sum, s) => sum + s.quantity, 0);

        setModifyProduct({
            barcode,
            sku: existingScan?.sku || barcode,
            name: existingScan?.product_name || barcode,
            currentQty
        });
        setModifyNewQty(currentQty > 0 ? String(currentQty) : '');
        setMode('MODIFY_QTY');
        setTimeout(() => modifyQtyInputRef.current?.focus(), 50);
    }, [scans]);

    const handleModifyConfirm = useCallback(async () => {
        if (!selectedAudit || !modifyProduct) return;
        const newQty = parseFloat(modifyNewQty);
        if (isNaN(newQty) || newQty < 0) return;

        try {
            const response = await fetch(`${AUDIT_API}/audits/${selectedAudit.session.id}/scans/modify`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: modifyProduct.barcode,
                    new_quantity: newQty
                })
            });

            if (response.ok) {
                fetchScans(selectedAudit.session.id);
                const action = modifyProduct.currentQty === 0 ? 'AGREGADO' : 'MODIFICADO';
                setLastScan({ product: `✏️ ${action}: ${modifyProduct.name} → ${newQty}`, quantity: newQty });
                setFlashColor('green');
                setTimeout(() => setFlashColor(null), 300);
                if (lastScanTimeout.current) clearTimeout(lastScanTimeout.current);
                lastScanTimeout.current = setTimeout(() => setLastScan(null), 3000);
            } else {
                setLastScan({ product: '❌ Error al modificar', quantity: 0 });
            }
        } catch (err) {
            console.error('Modify failed:', err);
            setLastScan({ product: '❌ Error al modificar', quantity: 0 });
        }

        // Reset modify state
        setModifyProduct(null);
        setModifyQuery('');
        setModifyResults([]);
        setModifyNewQty('');
        setMode('SCAN');
    }, [selectedAudit, modifyProduct, modifyNewQty]);

    // Disconnect from audit
    const handleDisconnect = useCallback(() => {
        setSelectedAudit(null);
        setScans([]);
        setSummary(null);
        setIsFinalized(false);
        setShowFinalizeConfirm(false);
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
        }
    }, []);

    // Finalize audit from POS
    const handleFinalize = useCallback(async () => {
        if (!selectedAudit) return;
        setIsFinalizing(true);
        try {
            const response = await fetch(`${AUDIT_API}/audits/${selectedAudit.session.id}/close-from-pos`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: deviceId,
                    closed_by: user?.id || deviceId,
                }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Error al finalizar');
            }
            setIsFinalized(true);
            setShowFinalizeConfirm(false);
            // Stop polling
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        } catch (err) {
            console.error('Failed to finalize audit:', err);
            setFlashColor('red');
            setTimeout(() => setFlashColor(null), 500);
        } finally {
            setIsFinalizing(false);
        }
    }, [selectedAudit, deviceId, userName]);

    // Keyboard event handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if we're connected to an audit
            if (!selectedAudit) return;

            // If finalize confirmation is showing, handle Enter/ESC
            if (showFinalizeConfirm) {
                if (e.key === 'Escape') {
                    setShowFinalizeConfirm(false);
                }
                if (e.key === 'Enter') {
                    handleFinalize();
                }
                return;
            }

            // If already finalized, only allow ESC to go back
            if (isFinalized) {
                if (e.key === 'Escape') {
                    handleDisconnect();
                }
                return;
            }

            // In input modes, only intercept ESC and actual function keys (F1-F12)
            if (mode === 'MANUAL_INPUT' || mode === 'MANUAL_QTY' || mode === 'REGISTER_PRODUCT' || mode === 'MODIFY_SEARCH' || mode === 'MODIFY_QTY') {
                if (e.key === 'Escape') {
                    setMode('SCAN');
                    setPendingQuantity('');
                    setBarcodeBuffer('');
                    setManualQuery('');
                    setManualResults([]);
                    setManualSelectedProduct(null);
                    setManualQty('1');
                    setRegisterBarcode('');
                    setRegisterSku('');
                    setRegisterName('');
                    setRegisterUnit('pz');
                    setRegisterPrice('');
                    setModifyQuery('');
                    setModifyResults([]);
                    setModifyProduct(null);
                    setModifyNewQty('');
                }
                return;
            }

            // Prevent default for actual function keys (F1-F12, not the letter "F")
            if (/^F\d{1,2}$/.test(e.key)) {
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

            // F3: Undo — two-step
            if (e.key === 'F3') {
                if (undoConfirm) {
                    handleUndoConfirm();
                } else {
                    handleUndoStep1();
                }
                return;
            }

            // F4: Modify quantity
            if (e.key === 'F4') {
                if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
                setBarcodeBuffer('');
                setMode('MODIFY_SEARCH');
                setModifyQuery('');
                setModifyResults([]);
                setModifySelectedIndex(0);
                setModifyProduct(null);
                setModifyNewQty('');
                setTimeout(() => modifyInputRef.current?.focus(), 50);
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

            // F10: Finalize audit
            if (e.key === 'F10') {
                if (!isFinalized) {
                    setShowFinalizeConfirm(true);
                }
                return;
            }

            // ESC: Cancel undo confirmation, cancel mode, or disconnect
            if (e.key === 'Escape') {
                if (undoConfirm) {
                    handleUndoCancel();
                    return;
                }
                // If already in SCAN mode, ESC = disconnect/exit
                if (mode === 'SCAN') {
                    handleDisconnect();
                    return;
                }
                setMode('SCAN');
                setPendingQuantity('');
                setBarcodeBuffer('');
                setManualQuery('');
                setManualResults([]);
                setManualSelectedProduct(null);
                setManualQty('1');
                setRegisterBarcode('');
                setRegisterSku('');
                setRegisterName('');
                setRegisterUnit('pz');
                setRegisterPrice('');
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
    }, [selectedAudit, mode, pendingQuantity, barcodeBuffer, sendScan, handleUndoStep1, handleUndoConfirm, handleUndoCancel, undoConfirm, searchLocalProducts, confirmManualProduct, handleModifySearch, handleModifySelectProduct, handleModifyFromBarcode, handleModifyConfirm, modifyResults, modifySelectedIndex, isFinalized, showFinalizeConfirm, handleFinalize, handleDisconnect]);

    // Select an audit to connect to
    const handleSelectAudit = (audit: RemoteAudit) => {
        setSelectedAudit(audit);
        setScans([]);
        setSummary(null);
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
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setShowCreateAudit(true);
                                fetchStores();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2"
                        >
                            ＋ Nueva Auditoría
                        </button>
                        <button
                            onClick={fetchActiveAudits}
                            disabled={isConnecting}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-xl"
                        >
                            {isConnecting ? 'Buscando...' : '🔄 Actualizar'}
                        </button>
                    </div>
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
                            <button onClick={() => setConnectionError(null)} className="ml-3 text-red-300 hover:text-white">✕</button>
                        </div>
                    )}

                    {reopenSuccess && (
                        <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-400 px-4 py-3 rounded-xl mb-4">
                            ✅ {reopenSuccess}
                        </div>
                    )}

                    {/* Create Audit Modal */}
                    {showCreateAudit && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4">
                                <h2 className="text-xl font-bold mb-4">Nueva Auditoría</h2>
                                <p className="text-slate-400 text-sm mb-4">
                                    Selecciona la tienda para crear una nueva auditoría de conteo.
                                </p>

                                {isLoadingStores ? (
                                    <div className="text-center py-6 text-slate-400">
                                        Cargando tiendas...
                                    </div>
                                ) : stores.length === 0 ? (
                                    <div className="text-center py-6 text-slate-500">
                                        No se encontraron tiendas
                                    </div>
                                ) : (() => {
                                    // Group stores by zone
                                    const zoneMap = new Map<string, Store[]>();
                                    stores.forEach(store => {
                                        const zoneName = store.zone_name || 'Sin Zona';
                                        if (!zoneMap.has(zoneName)) zoneMap.set(zoneName, []);
                                        zoneMap.get(zoneName)!.push(store);
                                    });
                                    const zoneEntries = Array.from(zoneMap.entries());
                                    const singleZone = zoneEntries.length === 1;

                                    return (
                                        <div className="max-h-60 overflow-auto mb-4">
                                            {zoneEntries.map(([zoneName, zoneStores]) => (
                                                <div key={zoneName}>
                                                    {!singleZone && (
                                                        <button
                                                            onClick={() => setExpandedZone(prev => prev === zoneName ? null : zoneName)}
                                                            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg mb-1 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                <span className="text-sm font-semibold text-slate-300">{zoneName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-500">{zoneStores.length}</span>
                                                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedZone === zoneName ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </div>
                                                        </button>
                                                    )}
                                                    {(singleZone || expandedZone === zoneName) && (
                                                        <div className={`grid gap-2 ${!singleZone ? 'pl-2 mb-2' : ''}`}>
                                                            {zoneStores.map(store => (
                                                                <button
                                                                    key={store.id}
                                                                    onClick={() => setSelectedStoreId(store.id)}
                                                                    className={`p-3 rounded-xl text-left transition-all border-2 ${selectedStoreId === store.id
                                                                            ? 'border-emerald-500 bg-emerald-500/20'
                                                                            : 'border-transparent bg-slate-700 hover:bg-slate-600'
                                                                        }`}
                                                                >
                                                                    <span className="font-medium">{store.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Audit name input (optional) */}
                                <div className="mb-2">
                                    <label className="block text-sm text-slate-400 mb-1">Nombre de auditoría (opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Auditoría semanal, Conteo rápido..."
                                        value={newAuditName}
                                        onChange={(e) => setNewAuditName(e.target.value)}
                                        maxLength={200}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => {
                                            setShowCreateAudit(false);
                                            setSelectedStoreId(null);
                                            setExpandedZone(null);
                                            setNewAuditName('');
                                        }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCreateAudit}
                                        disabled={!selectedStoreId || isCreatingAudit}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium"
                                    >
                                        {isCreatingAudit ? 'Creando...' : 'Crear Auditoría'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reopen Request Dialog */}
                    {showReopenDialog && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4">
                                <h2 className="text-xl font-bold mb-2">Solicitar Reapertura</h2>
                                <p className="text-slate-400 text-sm mb-4">
                                    <strong className="text-white">{showReopenDialog.store_name}</strong> —
                                    Se enviará una solicitud al administrador para reabrir esta auditoría.
                                </p>

                                <label className="block text-sm text-slate-400 mb-1">Motivo (opcional)</label>
                                <textarea
                                    value={reopenReason}
                                    onChange={(e) => setReopenReason(e.target.value)}
                                    placeholder="Describe por qué se necesita reabrir..."
                                    className="w-full bg-slate-700 rounded-xl p-3 text-white placeholder-slate-500 mb-4 resize-none"
                                    rows={3}
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowReopenDialog(null);
                                            setReopenReason('');
                                        }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => handleRequestReopen(showReopenDialog)}
                                        disabled={isRequestingReopen}
                                        className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium"
                                    >
                                        {isRequestingReopen ? 'Enviando...' : 'Enviar Solicitud'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeAudits.length === 0 && finalizedAudits.length === 0 && !isConnecting && !connectionError && (
                        <div className="text-center py-20 text-slate-500">
                            <div className="text-6xl mb-4">📋</div>
                            <div className="text-xl">No hay auditorías</div>
                            <div className="text-sm mt-2">
                                Presiona "Nueva Auditoría" para crear una, o crea una desde el panel web
                            </div>
                        </div>
                    )}

                    {/* Active Audits */}
                    {activeAudits.length > 0 && (
                        <>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Auditorías Activas</h2>
                            <div className="grid gap-4 mb-6">
                                {activeAudits.map(audit => (
                                    <button
                                        key={audit.session.id}
                                        onClick={() => handleSelectAudit(audit)}
                                        className="bg-slate-800 hover:bg-slate-700 p-6 rounded-xl text-left transition-all border-2 border-transparent hover:border-blue-500"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-bold">{audit.session.name || audit.store_name}</h2>
                                                {audit.session.name && (
                                                    <div className="text-slate-500 text-xs">{audit.store_name}</div>
                                                )}
                                                <div className="text-slate-400 text-sm mt-1">
                                                    Creada: {new Date(audit.session.created_at).toLocaleString()}
                                                </div>
                                                <div className="text-slate-400 text-sm">
                                                    Estado: <span className={`font-medium ${audit.session.status === 'IN_PROGRESS' ? 'text-blue-400' :
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
                        </>
                    )}

                    {/* Finalized Audits */}
                    {finalizedAudits.length > 0 && (
                        <>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Auditorías Finalizadas</h2>
                            <div className="grid gap-3">
                                {finalizedAudits.map(audit => (
                                    <div
                                        key={audit.session.id}
                                        className="bg-slate-800/60 p-4 rounded-xl border border-slate-700"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-slate-300">{audit.session.name || audit.store_name}</h3>
                                                <div className="text-slate-500 text-xs mt-1">
                                                    Finalizada: {new Date(audit.session.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowReopenDialog(audit);
                                                }}
                                                className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                🔓 Solicitar Reapertura
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Connected to an audit - INDUSTRIAL POS TERMINAL INTERFACE
    return (
        <div className={`flex flex-col h-screen bg-black text-white font-sans select-none transition-colors duration-200 ${flashColor === 'green' ? 'bg-green-900/60' :
                flashColor === 'red' ? 'bg-red-900/60' :
                    flashColor === 'amber' ? 'bg-amber-900/60' : ''
            }`}>
            {/* ===== HEADER BAR (compact) ===== */}
            <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm uppercase tracking-wide">{selectedAudit.session.name || selectedAudit.store_name}</span>
                    </div>
                    <span className="text-gray-500 text-xs font-mono">{deviceId}</span>
                </div>
                <div className="flex items-center gap-6">
                    {/* Inline stats */}
                    <div className="flex items-center gap-6 font-mono">
                        <span className="text-emerald-400 text-sm">UNIDADES:<span className="text-white font-bold ml-1 text-xl">{summary?.total_quantity || 0}</span></span>
                        <span className="text-purple-400 text-sm">PRODUCTOS:<span className="text-white font-bold ml-1 text-xl">{summary?.unique_products || 0}</span></span>
                        {(summary?.unknown_items || 0) > 0 && (
                            <span className="text-amber-400 text-sm">N/F:<span className="text-white font-bold ml-1 text-xl">{summary?.unknown_items}</span></span>
                        )}
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="bg-red-600/20 hover:bg-red-600 border border-red-500/50 hover:border-red-400 text-red-400 hover:text-white px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2"
                    >
                        ✕ SALIR
                    </button>
                </div>
            </div>

            {/* ===== MODE INDICATOR STRIP ===== */}
            {mode === 'QUANTITY_INPUT' && (
                <div className="bg-purple-700 px-4 py-2 text-center shrink-0">
                    <span className="font-mono text-lg font-bold tracking-widest">
                        CANTIDAD: {pendingQuantity || '▌'}
                    </span>
                    <span className="text-purple-200 text-xs ml-4">Escribe cantidad → Enter para confirmar</span>
                </div>
            )}
            {mode === 'QUANTITY_READY' && (
                <div className="bg-green-700 px-4 py-2 text-center shrink-0">
                    <span className="font-mono text-lg font-bold tracking-widest">
                        ✓ CANT: {pendingQuantity} → ESCANEA PRODUCTO
                    </span>
                </div>
            )}

            {/* ===== UNDO CONFIRMATION STRIP ===== */}
            {undoConfirm && (
                <div className="bg-red-900/90 border-y-2 border-red-500 px-4 py-3 shrink-0 animate-pulse-once">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-red-400 text-2xl">⚠</span>
                            <div>
                                <p className="text-red-300 text-xs font-mono uppercase tracking-wider mb-1">¿Eliminar del conteo?</p>
                                <div className="flex items-center gap-3">
                                    <span className="bg-red-800 text-red-200 font-mono text-sm px-2 py-0.5 rounded">
                                        {undoConfirm.scan.sku || undoConfirm.scan.barcode}
                                    </span>
                                    <span className="text-white font-bold text-base">
                                        {undoConfirm.scan.product_name || undoConfirm.scan.barcode}
                                    </span>
                                    <span className="text-red-300 font-mono text-lg font-bold">
                                        ×{undoConfirm.scan.quantity}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleUndoCancel}
                                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded font-mono text-sm font-bold uppercase tracking-wider transition-colors"
                            >
                                ESC Cancelar
                            </button>
                            <button
                                onClick={handleUndoConfirm}
                                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded font-mono text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                            >
                                <span className="bg-red-800 text-red-200 text-xs px-1.5 py-0.5 rounded">F3</span>
                                Confirmar Eliminación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== F4: MODIFY SEARCH ===== */}
            {mode === 'MODIFY_SEARCH' && (
                <div className="bg-cyan-900 border-b border-cyan-700 px-4 py-3 shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-cyan-300 text-xs uppercase font-bold tracking-wider">✏️ MODIFICAR CANTIDAD</span>
                        <span className="text-cyan-500 text-xs font-mono">Busca por nombre, SKU o escanea código de barras</span>
                    </div>
                    <input
                        ref={modifyInputRef}
                        type="text"
                        value={modifyQuery}
                        onChange={(e) => {
                            const val = e.target.value;
                            setModifyQuery(val);
                            handleModifySearch(val);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setModifySelectedIndex(prev => Math.min(prev + 1, modifyResults.length - 1));
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setModifySelectedIndex(prev => Math.max(prev - 1, 0));
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                // Check if typed a barcode (all digits, length >= 5)
                                if (/^\d{5,}$/.test(modifyQuery) && modifyResults.length === 0) {
                                    handleModifyFromBarcode(modifyQuery);
                                } else if (modifyResults.length > 0) {
                                    handleModifySelectProduct(modifyResults[modifySelectedIndex]);
                                }
                            } else if (e.key === 'Escape') {
                                setMode('SCAN');
                                setModifyQuery('');
                                setModifyResults([]);
                            }
                        }}
                        className="w-full bg-black border border-cyan-600 rounded px-3 py-2 text-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-gray-600"
                        placeholder="Escribe nombre, SKU o escanea código..."
                        autoFocus
                    />
                    {modifyResults.length > 0 && (
                        <div className="mt-2 max-h-48 overflow-auto rounded border border-cyan-800">
                            {modifyResults.slice(0, 8).map((p, idx) => {
                                const currentQty = scans.filter(s => s.barcode === p.barcode || s.sku === p.sku).reduce((sum, s) => sum + s.quantity, 0);
                                return (
                                    <div
                                        key={p.id}
                                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer font-mono text-sm transition-colors
                                            ${idx === modifySelectedIndex ? 'bg-cyan-800 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                                        onClick={() => handleModifySelectProduct(p)}
                                    >
                                        <span className="text-cyan-400 w-24 shrink-0">{p.sku}</span>
                                        <span className="flex-1 truncate">{p.name}</span>
                                        {currentQty > 0 ? (
                                            <span className="bg-emerald-900 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold">
                                                CONTEO: {currentQty}
                                            </span>
                                        ) : (
                                            <span className="bg-gray-800 text-gray-500 px-2 py-0.5 rounded text-xs">
                                                SIN CONTEO
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== F4: MODIFY QUANTITY INPUT ===== */}
            {mode === 'MODIFY_QTY' && modifyProduct && (
                <div className="bg-cyan-900 border-b-2 border-cyan-500 px-4 py-3 shrink-0">
                    <div className="flex items-center gap-4 mb-3">
                        <span className="text-cyan-300 text-xs uppercase font-bold tracking-wider">✏️ MODIFICAR CANTIDAD</span>
                    </div>
                    <div className="flex items-center gap-4 bg-black/40 rounded-lg px-4 py-3">
                        {/* Product info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="bg-cyan-800 text-cyan-200 font-mono text-sm px-2 py-0.5 rounded">{modifyProduct.sku}</span>
                                <span className="text-white font-bold text-base">{modifyProduct.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-gray-400">Conteo actual:</span>
                                <span className={`font-bold font-mono text-xl ${modifyProduct.currentQty > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {modifyProduct.currentQty > 0 ? modifyProduct.currentQty : '0 (sin conteo)'}
                                </span>
                            </div>
                        </div>
                        {/* New quantity input */}
                        <div className="flex items-center gap-3">
                            <span className="text-cyan-300 text-sm font-bold">NUEVA CANT:</span>
                            <input
                                ref={modifyQtyInputRef}
                                type="number"
                                min="0"
                                value={modifyNewQty}
                                onChange={(e) => setModifyNewQty(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleModifyConfirm();
                                    } else if (e.key === 'Escape') {
                                        setMode('SCAN');
                                        setModifyProduct(null);
                                        setModifyNewQty('');
                                    }
                                }}
                                className="w-28 bg-black border-2 border-cyan-500 rounded px-3 py-2 text-white font-mono text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                autoFocus
                            />
                            <button
                                onClick={handleModifyConfirm}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded font-mono text-sm font-bold uppercase tracking-wider transition-colors"
                            >
                                Enter ✓
                            </button>
                        </div>
                    </div>
                    {modifyProduct.currentQty === 0 && (
                        <p className="text-cyan-400/70 text-xs font-mono mt-2">
                            Este producto no ha sido escaneado aún. Ingresa la cantidad para agregarlo al conteo.
                        </p>
                    )}
                </div>
            )}

            {/* ===== MANUAL INPUT (QUANTITY AFTER SELECT) ===== */}
            {mode === 'MANUAL_QTY' && manualSelectedProduct && (
                <div className="bg-orange-800 px-4 py-3 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-orange-300 text-xs uppercase font-bold tracking-wider">PRODUCTO:</span>
                        <span className="font-bold truncate flex-1">{manualSelectedProduct.name}</span>
                        <span className="text-orange-300 font-mono text-sm">SKU:{manualSelectedProduct.sku}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-orange-200 text-sm font-bold">PIEZAS:</span>
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
                                    setMode('MANUAL_INPUT');
                                    setManualSelectedProduct(null);
                                    setTimeout(() => manualInputRef.current?.focus(), 50);
                                }
                            }}
                            className="w-24 px-3 py-2 bg-black text-white text-xl font-mono font-bold text-center border-2 border-orange-500 focus:border-orange-300 focus:outline-none"
                            autoFocus
                        />
                        <button
                            onClick={confirmManualProduct}
                            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 font-bold text-sm uppercase tracking-wider transition-colors"
                        >
                            ✓ OK
                        </button>
                        <span className="text-orange-400/50 text-xs ml-2">[Enter] Confirmar · [ESC] Volver</span>
                    </div>
                </div>
            )}

            {/* ===== MANUAL SEARCH INPUT ===== */}
            {mode === 'MANUAL_INPUT' && (
                <div className="bg-cyan-900 px-4 py-3 shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-cyan-300 text-xs uppercase font-bold tracking-wider">🔍 BÚSQUEDA MANUAL</span>
                        <span className="text-cyan-500 text-xs">nombre · SKU · código de barras</span>
                    </div>
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
                            className="w-full px-3 py-2 bg-black text-white text-sm font-mono border-2 border-cyan-600 focus:border-cyan-400 focus:outline-none placeholder-gray-600"
                            autoFocus
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 text-xs font-mono">BUSCANDO...</div>
                        )}
                    </div>
                    {/* Search Results - compact table style */}
                    {manualResults.length > 0 && (
                        <div className="mt-1 max-h-52 overflow-auto bg-black border border-gray-700">
                            {manualResults.map((product, idx) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleManualSelect(product)}
                                    className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm font-mono transition-colors
                                        ${idx === manualSelectedIndex ? 'bg-cyan-700 text-white' : 'text-gray-300 hover:bg-gray-800'}
                                        ${idx > 0 ? 'border-t border-gray-800' : ''}`}
                                >
                                    <span className="text-cyan-400 text-xs w-20 shrink-0">{product.sku}</span>
                                    <span className="flex-1 truncate">{product.name}</span>
                                    {product.barcode && <span className="text-gray-500 text-xs">{product.barcode}</span>}
                                    <span className="text-gray-600 text-xs w-8">{product.unit}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {manualQuery.length >= 2 && manualResults.length === 0 && !isSearching && (
                        <div className="mt-1 bg-black border border-gray-800">
                            <div className="text-center py-2 text-gray-500 text-xs font-mono">
                                SIN RESULTADOS PARA "{manualQuery.toUpperCase()}"
                            </div>
                            <button
                                onClick={() => {
                                    const q = manualQuery.trim();
                                    setRegisterBarcode(/^\d+$/.test(q) ? q : '');
                                    setRegisterSku(/^\d+$/.test(q) ? q : '');
                                    setRegisterName(/^\d+$/.test(q) ? '' : q);
                                    setRegisterUnit('pz');
                                    setRegisterPrice('');
                                    setRegisterQty(1);
                                    setRegisterFromScan(false);
                                    setManualQuery('');
                                    setManualResults([]);
                                    setMode('REGISTER_PRODUCT');
                                    setTimeout(() => registerSkuRef.current?.focus(), 50);
                                }}
                                className="w-full py-2 text-amber-400 hover:bg-amber-900/50 text-xs font-mono uppercase tracking-wider border-t border-gray-800 transition-colors"
                            >
                                + REGISTRAR PRODUCTO NUEVO
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ===== REGISTER UNKNOWN PRODUCT FORM ===== */}
            {mode === 'REGISTER_PRODUCT' && (
                <div className="bg-amber-900 px-4 py-3 shrink-0 border-y border-amber-700">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-amber-400 text-xs uppercase font-bold tracking-wider">⚠ PRODUCTO NO ENCONTRADO</span>
                        <span className="text-amber-600 text-xs font-mono">Registrar en catálogo local</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {/* Row 1: SKU (required) + Barcode (pre-filled, required) */}
                        <div className="flex items-center gap-2">
                            <label className="text-amber-300 text-xs font-bold w-20 shrink-0 text-right">SKU *</label>
                            <input
                                ref={registerSkuRef}
                                type="text"
                                value={registerSku}
                                onChange={(e) => setRegisterSku(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        confirmRegisterProduct();
                                    } else if (e.key === 'Escape') {
                                        setMode('SCAN');
                                    }
                                }}
                                className="flex-1 px-2 py-1.5 bg-black text-white text-sm font-mono border-2 border-amber-600 focus:border-amber-400 focus:outline-none"
                                placeholder="SKU del producto"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-amber-300 text-xs font-bold w-20 shrink-0 text-right">CÓDIGO *</label>
                            <input
                                type="text"
                                value={registerBarcode}
                                onChange={(e) => setRegisterBarcode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); confirmRegisterProduct(); }
                                    else if (e.key === 'Escape') { setMode('SCAN'); }
                                }}
                                className="flex-1 px-2 py-1.5 bg-black text-white text-sm font-mono border-2 border-amber-600 focus:border-amber-400 focus:outline-none"
                                placeholder="Código de barras"
                            />
                        </div>
                        {/* Row 2: Name (optional) + Unit (optional) */}
                        <div className="flex items-center gap-2">
                            <label className="text-amber-500 text-xs font-bold w-20 shrink-0 text-right">NOMBRE</label>
                            <input
                                type="text"
                                value={registerName}
                                onChange={(e) => setRegisterName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); confirmRegisterProduct(); }
                                    else if (e.key === 'Escape') { setMode('SCAN'); }
                                }}
                                className="flex-1 px-2 py-1.5 bg-black text-white text-sm font-mono border border-gray-700 focus:border-amber-500 focus:outline-none"
                                placeholder="Nombre del producto (opcional)"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-amber-500 text-xs font-bold w-20 shrink-0 text-right">UNIDAD</label>
                            <input
                                type="text"
                                value={registerUnit}
                                onChange={(e) => setRegisterUnit(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); confirmRegisterProduct(); }
                                    else if (e.key === 'Escape') { setMode('SCAN'); }
                                }}
                                className="w-20 px-2 py-1.5 bg-black text-white text-sm font-mono border border-gray-700 focus:border-amber-500 focus:outline-none"
                                placeholder="pz"
                            />
                            {/* Price */}
                            <label className="text-amber-500 text-xs font-bold w-16 shrink-0 text-right">PRECIO</label>
                            <input
                                type="number"
                                step="0.01"
                                value={registerPrice}
                                onChange={(e) => setRegisterPrice(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); confirmRegisterProduct(); }
                                    else if (e.key === 'Escape') { setMode('SCAN'); }
                                }}
                                className="w-24 px-2 py-1.5 bg-black text-white text-sm font-mono border border-gray-700 focus:border-amber-500 focus:outline-none"
                                placeholder="$0.00"
                            />
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-3">
                        {/* Quantity input (only for manual registration, scan already has qty) */}
                        {!registerFromScan && (
                            <>
                                <label className="text-amber-300 text-xs font-bold">CANT:</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={registerQty}
                                    onChange={(e) => setRegisterQty(parseInt(e.target.value) || 1)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); confirmRegisterProduct(); }
                                        else if (e.key === 'Escape') { setMode('SCAN'); }
                                    }}
                                    className="w-16 px-2 py-1.5 bg-black text-white text-sm font-mono font-bold text-center border-2 border-amber-600 focus:border-amber-400 focus:outline-none"
                                />
                            </>
                        )}
                        <button
                            onClick={confirmRegisterProduct}
                            disabled={!registerSku.trim() || !registerBarcode.trim()}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-1.5 font-bold text-sm uppercase tracking-wider transition-colors"
                        >
                            ✓ REGISTRAR
                        </button>
                        <button
                            onClick={() => { setMode('SCAN'); }}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-1.5 text-sm uppercase tracking-wider transition-colors"
                        >
                            OMITIR
                        </button>
                        <span className="text-amber-600/50 text-[10px] font-mono ml-2">[Enter] Registrar · [ESC] Omitir · * = obligatorio</span>
                    </div>
                </div>
            )}

            {/* ===== MAIN SPLIT SCREEN ===== */}
            <div className="flex-1 flex overflow-hidden">
                {/* ===== LEFT PANEL: AHORA (current scan / status) ===== */}
                <div className="w-2/5 border-r border-gray-800 flex flex-col bg-gray-950">
                    {/* Current scan display - BIG */}
                    {lastScan ? (
                        <div className={`flex-1 flex flex-col items-center justify-center p-6 ${lastScan.isUnknown ? 'text-amber-400' :
                                lastScan.quantity === 0 ? 'text-gray-400' : 'text-green-400'
                            }`}>
                            {lastScan.quantity > 0 && (
                                <div className="text-8xl font-mono font-black mb-4 leading-none">
                                    +{lastScan.quantity}
                                </div>
                            )}
                            <div className="text-xl font-bold text-center text-white max-w-full px-4">
                                {lastScan.product}
                            </div>
                            {lastScan.isUnknown && (
                                <div className="text-amber-500 text-sm font-mono mt-3 uppercase tracking-wider">
                                    ⚠ NO CATALOGADO
                                </div>
                            )}
                            {lastScan.quantity === 0 && (
                                <div className="text-gray-500 text-sm font-mono mt-3 uppercase">
                                    {lastScan.product}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                            <div className="text-6xl mb-4 opacity-30">⎕</div>
                            <div className="text-sm font-mono uppercase tracking-widest">ESPERANDO ESCANEO</div>
                            {isSending && (
                                <div className="text-blue-500 text-xs font-mono mt-3 animate-pulse">ENVIANDO...</div>
                            )}
                        </div>
                    )}

                    {/* Mode badge at bottom of left panel */}
                    <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 text-center">
                        <span className={`text-xs font-mono uppercase tracking-widest ${mode === 'SCAN' ? 'text-green-500' :
                                mode === 'QUANTITY_INPUT' || mode === 'QUANTITY_READY' ? 'text-purple-400' :
                                    mode === 'MANUAL_INPUT' || mode === 'MANUAL_QTY' ? 'text-cyan-400' :
                                        mode === 'REGISTER_PRODUCT' ? 'text-amber-400' :
                                            mode === 'MODIFY_SEARCH' || mode === 'MODIFY_QTY' ? 'text-cyan-400' :
                                                'text-gray-500'
                            }`}>
                            {mode === 'SCAN' && '● LISTO PARA ESCANEAR'}
                            {mode === 'QUANTITY_INPUT' && '▶ INGRESANDO CANTIDAD'}
                            {mode === 'QUANTITY_READY' && `▶ CANT: ${pendingQuantity} → ESCANEA`}
                            {mode === 'MANUAL_INPUT' && '▶ BÚSQUEDA MANUAL'}
                            {mode === 'MANUAL_QTY' && '▶ CONFIRMAR CANTIDAD'}
                            {mode === 'REGISTER_PRODUCT' && '▶ REGISTRAR PRODUCTO'}
                            {mode === 'MODIFY_SEARCH' && '▶ MODIFICAR: BUSCAR PRODUCTO'}
                            {mode === 'MODIFY_QTY' && '▶ MODIFICAR: NUEVA CANTIDAD'}
                        </span>
                    </div>
                </div>

                {/* ===== RIGHT PANEL: HISTORIAL (scan history table) ===== */}
                <div className="w-3/5 flex flex-col bg-black">
                    {/* Table header */}
                    <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-gray-500 shrink-0">
                        <span className="w-20">HORA</span>
                        <span className="w-28">SKU</span>
                        <span className="flex-1">PRODUCTO</span>
                        <span className="w-20 text-right">CANT.</span>
                    </div>

                    {/* Scan rows - dense table */}
                    <div className="flex-1 overflow-auto">
                        {(() => {
                            // Group scans by SKU/barcode
                            const grouped = scans.reduce<Record<string, { key: string; product_name: string; sku: string; barcode: string; quantity: number; is_unknown: boolean; lastId: number; lastTime: string }>>((acc, scan) => {
                                const key = scan.sku || scan.barcode;
                                if (acc[key]) {
                                    acc[key].quantity += scan.quantity;
                                    if (scan.id > acc[key].lastId) {
                                        acc[key].lastId = scan.id;
                                        acc[key].lastTime = scan.scanned_at;
                                    }
                                } else {
                                    acc[key] = {
                                        key,
                                        product_name: scan.product_name || scan.barcode,
                                        sku: scan.sku || '',
                                        barcode: scan.barcode,
                                        quantity: scan.quantity,
                                        is_unknown: scan.is_unknown,
                                        lastId: scan.id,
                                        lastTime: scan.scanned_at,
                                    };
                                }
                                return acc;
                            }, {});
                            const items = Object.values(grouped).sort((a, b) => b.lastId - a.lastId);
                            return items.map((item, index) => (
                                <div
                                    key={item.key}
                                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-900 font-mono transition-colors
                                        ${index === 0 ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900'}
                                        ${item.is_unknown ? 'border-l-2 border-l-amber-600' : ''}`}
                                >
                                    <span className="w-20 text-sm text-gray-600 tabular-nums shrink-0">
                                        {item.lastTime ? new Date(item.lastTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--'}
                                    </span>
                                    <span className={`w-28 text-base shrink-0 ${item.is_unknown ? 'text-amber-500' : 'text-blue-400'}`}>
                                        {item.sku || item.barcode.substring(0, 12)}
                                    </span>
                                    <span className={`flex-1 truncate text-base ${index === 0 ? 'text-white' : 'text-gray-300'}`}>
                                        {item.product_name}
                                        {item.is_unknown && ' ⚠'}
                                    </span>
                                    <span className={`w-20 text-right font-bold tabular-nums ${index === 0 ? 'text-green-400 text-2xl' : 'text-gray-300 text-xl'
                                        }`}>
                                        {item.quantity}
                                    </span>
                                </div>
                            ));
                        })()}

                        {scans.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-700">
                                <div className="text-4xl mb-3 opacity-30">📦</div>
                                <div className="text-xs font-mono uppercase tracking-widest">Sin escaneos</div>
                                <div className="text-xs font-mono text-gray-800 mt-1">
                                    Usa la pistola o [F7] manual
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== FINALIZE CONFIRMATION MODAL ===== */}
            {showFinalizeConfirm && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="text-center mb-5">
                            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1 font-mono uppercase tracking-wide">Finalizar Conteo</h3>
                            <p className="text-sm text-gray-400">
                                ¿Estás seguro de que deseas finalizar el conteo de esta auditoría?
                            </p>
                        </div>

                        {/* Summary */}
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-5">
                            <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Resumen</div>
                            <div className="flex items-center justify-between text-sm font-mono mb-1">
                                <span className="text-gray-400">Tienda</span>
                                <span className="text-white font-bold">{selectedAudit?.store_name}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-mono mb-1">
                                <span className="text-gray-400">Escaneos</span>
                                <span className="text-blue-400 font-bold">{summary?.total_scans || 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-mono mb-1">
                                <span className="text-gray-400">Unidades</span>
                                <span className="text-emerald-400 font-bold">{summary?.total_quantity || 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-mono">
                                <span className="text-gray-400">Productos únicos</span>
                                <span className="text-purple-400 font-bold">{summary?.unique_products || 0}</span>
                            </div>
                        </div>

                        <p className="text-xs text-amber-400/80 text-center mb-5">
                            Una vez finalizado, no se podrán agregar más escaneos desde esta terminal.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowFinalizeConfirm(false)}
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-mono text-sm uppercase tracking-wider transition-colors border border-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleFinalize}
                                disabled={isFinalizing}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-mono text-sm font-bold uppercase tracking-wider transition-colors"
                            >
                                {isFinalizing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Finalizando...
                                    </span>
                                ) : (
                                    'Sí, Finalizar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== FINALIZED OVERLAY ===== */}
            {isFinalized && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 pointer-events-none">
                    <div className="text-center pointer-events-auto">
                        <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-5">
                            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2 font-mono uppercase tracking-widest">Conteo Finalizado</h2>
                        <p className="text-gray-400 text-sm mb-2">
                            {selectedAudit?.store_name} — {summary?.total_scans || 0} escaneos, {summary?.total_quantity || 0} unidades
                        </p>
                        <p className="text-gray-500 text-xs mb-6">
                            El estado ha sido actualizado en el sistema.
                        </p>
                        <button
                            onClick={handleDisconnect}
                            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-mono text-sm uppercase tracking-wider transition-colors border border-gray-600"
                        >
                            Volver al menú
                        </button>
                    </div>
                </div>
            )}

            {/* ===== FOOTER COMMAND BAR (DOS/BIOS style) ===== */}
            <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-1">
                    <span className="bg-yellow-500 text-black text-xs font-mono font-bold px-2 py-0.5 rounded">F2</span>
                    <span className="text-gray-300 text-sm font-mono">Cantidad</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="bg-yellow-500 text-black text-xs font-mono font-bold px-2 py-0.5 rounded">F3</span>
                    <span className="text-gray-300 text-sm font-mono">Deshacer</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="bg-cyan-500 text-black text-xs font-mono font-bold px-2 py-0.5 rounded">F4</span>
                    <span className="text-gray-300 text-sm font-mono">Modificar</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="bg-yellow-500 text-black text-xs font-mono font-bold px-2 py-0.5 rounded">F7</span>
                    <span className="text-gray-300 text-sm font-mono">Manual</span>
                </div>
                <div className="flex-1"></div>
                {isSending && (
                    <span className="text-blue-400 text-xs font-mono animate-pulse uppercase">Enviando...</span>
                )}
                {!isFinalized && (
                    <button
                        onClick={() => setShowFinalizeConfirm(true)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold px-3 py-1.5 rounded transition-colors uppercase tracking-wider"
                    >
                        <span className="bg-emerald-800 text-emerald-200 text-xs font-mono font-bold px-1.5 py-0.5 rounded">F10</span>
                        Finalizar Conteo
                    </button>
                )}
                {isFinalized && (
                    <span className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">✓ CONTEO FINALIZADO</span>
                )}
                <span className="text-gray-600 text-xs font-mono">
                    {new Date().toLocaleDateString('es-MX')}
                </span>
            </div>
        </div>
    );
};

export default PhysicalAudit;
