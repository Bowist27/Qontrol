/**
 * Red Comercial View - Zones & Stores
 * Two tabs: Zonas (regions with supervisor/price rules) & Sucursales (physical stores)
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Store,
    Plus,
    Trash2,
    Ban,
    CheckCircle,
    Search,
    Save,
    X,
    AlertCircle,
    MapPin,
    Building2,
    Users,
    DollarSign,
} from 'lucide-react';
import usersApi, {
    type Store as StoreType,
    type Zone,
    type PriceList,
    type User,
} from '../../services/users.api';

type TabType = 'zonas' | 'sucursales';

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function StoresView() {
    const [activeTab, setActiveTab] = useState<TabType>('zonas');

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Red Comercial</h1>
                    <p className="text-slate-500 mt-1">Gestiona zonas y sucursales del sistema</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('zonas')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                        activeTab === 'zonas'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <MapPin className="w-4 h-4" />
                    Zonas
                </button>
                <button
                    onClick={() => setActiveTab('sucursales')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                        activeTab === 'sucursales'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Building2 className="w-4 h-4" />
                    Sucursales
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'zonas' ? <ZonasTab /> : <SucursalesTab />}
        </div>
    );
}

// =====================================================
// ZONAS TAB
// =====================================================
function ZonasTab() {
    const [zones, setZones] = useState<Zone[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [priceLists, setPriceLists] = useState<PriceList[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewZone, setShowNewZone] = useState(false);
    const [editingZone, setEditingZone] = useState<Zone | null>(null);
    const [newZone, setNewZone] = useState({ name: '', supervisor_id: '', price_list_id: 0 });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [zonesData, usersData, priceListsData] = await Promise.all([
                usersApi.getZones(),
                usersApi.getUsers(),
                usersApi.getPriceLists(),
            ]);
            setZones(zonesData);
            setUsers(usersData);
            setPriceLists(priceListsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredZones = zones.filter(zone =>
        zone.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateZone = async () => {
        if (!newZone.name.trim()) return;

        try {
            setSaving(true);
            setError(null);
            await usersApi.createZone({
                name: newZone.name.trim(),
                supervisor_id: newZone.supervisor_id || undefined,
                price_list_id: newZone.price_list_id || undefined,
            });
            setNewZone({ name: '', supervisor_id: '', price_list_id: 0 });
            setShowNewZone(false);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al crear zona');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateZone = async (zone: Zone) => {
        try {
            setSaving(true);
            setError(null);
            await usersApi.updateZone(zone.id, {
                name: zone.name,
                supervisor_id: zone.supervisor_id || undefined,
                price_list_id: zone.price_list_id || undefined,
                status: zone.status,
            });
            setEditingZone(null);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al actualizar zona');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteZone = async (id: number) => {
        try {
            setSaving(true);
            setError(null);
            await usersApi.deleteZone(id);
            setDeleteConfirm(null);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'No se puede eliminar: la zona tiene sucursales asignadas');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (zone: Zone) => {
        try {
            await usersApi.updateZone(zone.id, {
                name: zone.name,
                supervisor_id: zone.supervisor_id || undefined,
                price_list_id: zone.price_list_id || undefined,
                status: !zone.status,
            });
            await loadData();
        } catch (error) {
            console.error('Error toggling zone status:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header with Search and Add button */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar zonas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={() => setShowNewZone(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Zona
                </button>
            </div>

            {/* New Zone Form */}
            {showNewZone && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        Nueva Zona
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                            <input
                                type="text"
                                value={newZone.name}
                                onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                                placeholder="Ej: Zona Norte"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                <Users className="w-3 h-3 inline mr-1" />
                                Supervisor
                            </label>
                            <select
                                value={newZone.supervisor_id}
                                onChange={(e) => setNewZone({ ...newZone, supervisor_id: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            >
                                <option value="">Sin asignar</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.first_name} {user.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                <DollarSign className="w-3 h-3 inline mr-1" />
                                Lista de Precios
                            </label>
                            <select
                                value={newZone.price_list_id}
                                onChange={(e) => setNewZone({ ...newZone, price_list_id: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            >
                                <option value="0">Estándar (sin ajuste)</option>
                                {priceLists.map((pl) => (
                                    <option key={pl.id} value={pl.id}>
                                        {pl.name} ({pl.adjustment_percent > 0 ? '+' : ''}{pl.adjustment_percent}%)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCreateZone}
                            disabled={saving || !newZone.name.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Guardar
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setShowNewZone(false);
                                setNewZone({ name: '', supervisor_id: '', price_list_id: 0 });
                            }}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Zones Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Zona
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Supervisor
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Lista de Precios
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Sucursales
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredZones.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm ? 'No se encontraron zonas' : 'No hay zonas registradas'}
                                </td>
                            </tr>
                        ) : (
                            filteredZones.map((zone) => (
                                <tr key={zone.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {editingZone?.id === zone.id ? (
                                            <input
                                                type="text"
                                                value={editingZone.name}
                                                onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                                                className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <span className="font-medium text-slate-800">{zone.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingZone?.id === zone.id ? (
                                            <select
                                                value={editingZone.supervisor_id || ''}
                                                onChange={(e) => setEditingZone({ ...editingZone, supervisor_id: e.target.value || undefined })}
                                                className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                            >
                                                <option value="">Sin asignar</option>
                                                {users.map((user) => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.first_name} {user.last_name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-slate-600">
                                                {zone.supervisor_name || <span className="text-slate-400 italic">Sin asignar</span>}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingZone?.id === zone.id ? (
                                            <select
                                                value={editingZone.price_list_id || 0}
                                                onChange={(e) => setEditingZone({ ...editingZone, price_list_id: parseInt(e.target.value) || undefined })}
                                                className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                            >
                                                <option value="0">Estándar</option>
                                                {priceLists.map((pl) => (
                                                    <option key={pl.id} value={pl.id}>
                                                        {pl.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-slate-600">
                                                {zone.price_list_name || 'Estándar'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                                            <Building2 className="w-3.5 h-3.5" />
                                            {zone.store_count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleStatus(zone)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                                zone.status
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {zone.status ? (
                                                <>
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Activa
                                                </>
                                            ) : (
                                                <>
                                                    <Ban className="w-3.5 h-3.5" />
                                                    Inactiva
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingZone?.id === zone.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateZone(editingZone)}
                                                        disabled={saving}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Guardar"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingZone(null)}
                                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setEditingZone(zone)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    {deleteConfirm === zone.id ? (
                                                        <div className="flex items-center gap-1 bg-red-50 rounded-lg px-2 py-1">
                                                            <span className="text-xs text-red-600 mr-1">¿Eliminar?</span>
                                                            <button
                                                                onClick={() => handleDeleteZone(zone.id)}
                                                                disabled={saving}
                                                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(null)}
                                                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirm(zone.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Info about zones */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                <MapPin className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <div className="text-sm text-purple-700">
                    <p className="font-medium">Información sobre zonas</p>
                    <p className="mt-1">Las zonas agrupan sucursales para facilitar la administración. Cada zona tiene un supervisor asignado y una lista de precios. No se pueden eliminar zonas que tienen sucursales asignadas.</p>
                </div>
            </div>
        </div>
    );
}

// =====================================================
// SUCURSALES TAB
// =====================================================
function SucursalesTab() {
    const [stores, setStores] = useState<StoreType[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewStore, setShowNewStore] = useState(false);
    const [editingStore, setEditingStore] = useState<StoreType | null>(null);
    const [newStore, setNewStore] = useState({ name: '', zone_id: 0 });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [storesData, zonesData] = await Promise.all([
                usersApi.getStores(),
                usersApi.getZones(),
            ]);
            setStores(storesData);
            setZones(zonesData);
        } catch (error) {
            console.error('Error loading stores:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredStores = stores.filter(store =>
        store.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateStore = async () => {
        if (!newStore.name.trim()) return;

        try {
            setSaving(true);
            setError(null);
            await usersApi.createStore({
                name: newStore.name.trim(),
                zone_id: newStore.zone_id || undefined,
            });
            setNewStore({ name: '', zone_id: 0 });
            setShowNewStore(false);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al crear sucursal');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStore = async (store: StoreType) => {
        try {
            setSaving(true);
            setError(null);
            await usersApi.updateStore(store.id, {
                name: store.name,
                status: store.status,
                zone_id: store.zone_id || undefined,
            });
            setEditingStore(null);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al actualizar sucursal');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStore = async (id: number) => {
        try {
            setSaving(true);
            setError(null);
            await usersApi.deleteStore(id);
            setDeleteConfirm(null);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'No se puede eliminar: la sucursal está en uso');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (store: StoreType) => {
        try {
            await usersApi.updateStore(store.id, {
                name: store.name,
                status: !store.status,
                zone_id: store.zone_id || undefined,
            });
            await loadData();
        } catch (error) {
            console.error('Error toggling store status:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header with Search and Add button */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar sucursales..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={() => setShowNewStore(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Sucursal
                </button>
            </div>

            {/* New Store Form */}
            {showNewStore && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-600" />
                        Nueva Sucursal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                            <input
                                type="text"
                                value={newStore.name}
                                onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                                placeholder="Ej: Sucursal Centro"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                <MapPin className="w-3 h-3 inline mr-1" />
                                Zona
                            </label>
                            <select
                                value={newStore.zone_id}
                                onChange={(e) => setNewStore({ ...newStore, zone_id: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            >
                                <option value="0">Sin zona asignada</option>
                                {zones.filter(z => z.status).map((zone) => (
                                    <option key={zone.id} value={zone.id}>
                                        {zone.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCreateStore}
                            disabled={saving || !newStore.name.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Guardar
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setShowNewStore(false);
                                setNewStore({ name: '', zone_id: 0 });
                            }}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Stores Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Sucursal
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Zona
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStores.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm ? 'No se encontraron sucursales' : 'No hay sucursales registradas'}
                                </td>
                            </tr>
                        ) : (
                            filteredStores.map((store) => (
                                <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {editingStore?.id === store.id ? (
                                            <input
                                                type="text"
                                                value={editingStore.name}
                                                onChange={(e) => setEditingStore({ ...editingStore, name: e.target.value })}
                                                className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <span className="font-medium text-slate-800">{store.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingStore?.id === store.id ? (
                                            <select
                                                value={editingStore.zone_id || 0}
                                                onChange={(e) => setEditingStore({ ...editingStore, zone_id: parseInt(e.target.value) || undefined })}
                                                className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                            >
                                                <option value="0">Sin zona</option>
                                                {zones.filter(z => z.status).map((zone) => (
                                                    <option key={zone.id} value={zone.id}>
                                                        {zone.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                store.zone_name
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <MapPin className="w-3 h-3" />
                                                {store.zone_name || 'Sin zona'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleStatus(store)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                                store.status
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {store.status ? (
                                                <>
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Activa
                                                </>
                                            ) : (
                                                <>
                                                    <Ban className="w-3.5 h-3.5" />
                                                    Inactiva
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingStore?.id === store.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateStore(editingStore)}
                                                        disabled={saving}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Guardar"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingStore(null)}
                                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setEditingStore(store)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    {deleteConfirm === store.id ? (
                                                        <div className="flex items-center gap-1 bg-red-50 rounded-lg px-2 py-1">
                                                            <span className="text-xs text-red-600 mr-1">¿Eliminar?</span>
                                                            <button
                                                                onClick={() => handleDeleteStore(store.id)}
                                                                disabled={saving}
                                                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(null)}
                                                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirm(store.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Info about stores usage */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                    <p className="font-medium">Información sobre sucursales</p>
                    <p className="mt-1">Las sucursales heredan la lista de precios y supervisor de su zona asignada. No se pueden eliminar sucursales que tengan usuarios asignados o auditorías asociadas.</p>
                </div>
            </div>
        </div>
    );
}
