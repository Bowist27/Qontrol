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
} from 'lucide-react';
import usersApi, {
    type Store as StoreType,
    type Zone,
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
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingZone, setEditingZone] = useState<Zone | null>(null);
    const [formData, setFormData] = useState<{ name: string; supervisor_ids: string[] }>({ name: '', supervisor_ids: [] });
    const [saving, setSaving] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [zonesData, usersData] = await Promise.all([
                usersApi.getZones(),
                usersApi.getUsers(),
            ]);
            setZones(zonesData);
            setUsers(usersData);
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

    const openCreateModal = () => {
        setEditingZone(null);
        setFormData({ name: '', supervisor_ids: [] });
        setShowModal(true);
    };

    const openEditModal = (zone: Zone) => {
        setEditingZone(zone);
        setFormData({
            name: zone.name,
            supervisor_ids: zone.supervisors?.map(s => s.user_id) || [],
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingZone(null);
        setFormData({ name: '', supervisor_ids: [] });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        try {
            setSaving(true);
            setError(null);

            if (editingZone) {
                // Update
                await usersApi.updateZone(editingZone.id, {
                    name: formData.name.trim(),
                    supervisor_ids: formData.supervisor_ids.length > 0 ? formData.supervisor_ids : undefined,
                    status: editingZone.status,
                });
            } else {
                // Create
                await usersApi.createZone({
                    name: formData.name.trim(),
                    supervisor_ids: formData.supervisor_ids.length > 0 ? formData.supervisor_ids : undefined,
                });
            }

            closeModal();
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al guardar zona');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteZone = async () => {
        if (!deleteModal) return;
        try {
            setSaving(true);
            setError(null);
            await usersApi.deleteZone(deleteModal.id);
            setDeleteModal(null);
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'No se puede eliminar: la zona tiene sucursales asignadas');
            setDeleteModal(null);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (zone: Zone) => {
        try {
            await usersApi.updateZone(zone.id, {
                name: zone.name,
                supervisor_ids: zone.supervisors?.map(s => s.user_id),
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
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Zona
                </button>
            </div>

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
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm ? 'No se encontraron zonas' : 'No hay zonas registradas'}
                                </td>
                            </tr>
                        ) : (
                            filteredZones.map((zone) => (
                                <tr key={zone.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                                <MapPin className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium text-slate-800">{zone.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {zone.supervisors && zone.supervisors.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {zone.supervisors.map((s) => (
                                                    <span key={s.user_id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                                                        <Users className="w-3 h-3" />
                                                        {s.full_name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">Sin asignar</span>
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
                                            <button
                                                onClick={() => openEditModal(zone)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setDeleteModal({ id: zone.id, name: zone.name })}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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

            {/* Create/Edit Zone Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-lg mx-4 shadow-2xl w-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingZone ? 'Editar Zona' : 'Nueva Zona'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {editingZone ? 'Modifica los datos de la zona' : 'Crea una nueva zona geográfica'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Zona Norte"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Users className="w-3.5 h-3.5 inline mr-1" />
                                    Supervisores
                                </label>
                                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                                    {users.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic p-2">No hay usuarios disponibles</p>
                                    ) : (
                                        users.map((user) => (
                                            <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.supervisor_ids.includes(user.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, supervisor_ids: [...formData.supervisor_ids, user.id] });
                                                        } else {
                                                            setFormData({ ...formData, supervisor_ids: formData.supervisor_ids.filter(id => id !== user.id) });
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                />
                                                <span className="text-sm text-gray-700">{user.first_name} {user.last_name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                {formData.supervisor_ids.length > 0 && (
                                    <p className="mt-1 text-xs text-gray-500">{formData.supervisor_ids.length} supervisor(es) seleccionado(s)</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end mt-6">
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingZone ? 'Guardar Cambios' : 'Crear Zona'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Zone Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Eliminar Zona</h3>
                                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
                            </div>
                        </div>

                        <p className="text-gray-700 mb-6">
                            ¿Estás seguro que deseas eliminar la zona <span className="font-semibold text-gray-900">"{deleteModal.name}"</span>?
                        </p>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-700">
                                    No se pueden eliminar zonas que tienen sucursales asignadas. Primero debes reasignar las sucursales a otra zona.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteModal(null)}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteZone}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar Zona
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

// =====================================================
// SUCURSALES TAB
// =====================================================
function SucursalesTab() {
    const [stores, setStores] = useState<StoreType[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingStore, setEditingStore] = useState<StoreType | null>(null);
    const [formData, setFormData] = useState({ name: '', zone_id: 0 });
    const [saving, setSaving] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Zone filter state
    const [selectedZoneFilter, setSelectedZoneFilter] = useState<number | 'all'>('all');

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

    const filteredStores = stores.filter(store => {
        const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesZone = selectedZoneFilter === 'all'
            ? true
            : selectedZoneFilter === 0
                ? !store.zone_id
                : store.zone_id === selectedZoneFilter;
        return matchesSearch && matchesZone;
    });

    // Pagination calculations
    const totalItems = filteredStores.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const paginatedStores = filteredStores.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedZoneFilter]);

    const openCreateModal = () => {
        setEditingStore(null);
        setFormData({ name: '', zone_id: 0 });
        setShowModal(true);
    };

    const openEditModal = (store: StoreType) => {
        setEditingStore(store);
        setFormData({
            name: store.name,
            zone_id: store.zone_id || 0,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingStore(null);
        setFormData({ name: '', zone_id: 0 });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        try {
            setSaving(true);
            setError(null);

            if (editingStore) {
                // Update
                await usersApi.updateStore(editingStore.id, {
                    name: formData.name.trim(),
                    status: editingStore.status,
                    zone_id: formData.zone_id || undefined,
                });
            } else {
                // Create
                await usersApi.createStore({
                    name: formData.name.trim(),
                    zone_id: formData.zone_id || undefined,
                });
            }

            closeModal();
            await loadData();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al guardar sucursal');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStore = async () => {
        if (!deleteModal) return;
        try {
            setSaving(true);
            setError(null);
            await usersApi.deleteStore(deleteModal.id);
            setDeleteModal(null);
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

            {/* Header with Search, Zone Filter, and Add button */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar sucursales..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <select
                            value={selectedZoneFilter === 'all' ? 'all' : selectedZoneFilter}
                            onChange={(e) => setSelectedZoneFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">Todas las zonas</option>
                            <option value="0">Sin zona</option>
                            {zones.map((zone) => (
                                <option key={zone.id} value={zone.id}>
                                    {zone.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Sucursal
                </button>
            </div>

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
                        {paginatedStores.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm || selectedZoneFilter !== 'all' ? 'No se encontraron sucursales con los filtros aplicados' : 'No hay sucursales registradas'}
                                </td>
                            </tr>
                        ) : (
                            paginatedStores.map((store) => (
                                <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium text-slate-800">{store.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                            store.zone_name
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <MapPin className="w-3 h-3" />
                                            {store.zone_name || 'Sin zona'}
                                        </span>
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
                                            <button
                                                onClick={() => openEditModal(store)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setDeleteModal({ id: store.id, name: store.name })}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {totalItems > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 px-6 py-3">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-medium">Filas:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-slate-600">
                                {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Primera página"
                                >
                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Anterior"
                                >
                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Siguiente"
                                >
                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage >= totalPages}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Última página"
                                >
                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Info about stores usage */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                    <p className="font-medium">Información sobre sucursales</p>
                    <p className="mt-1">Las sucursales heredan la lista de precios y supervisor de su zona asignada. No se pueden eliminar sucursales que tengan auditorías asociadas.</p>
                </div>
            </div>

            {/* Create/Edit Store Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-lg mx-4 shadow-2xl w-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Store className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingStore ? 'Editar Sucursal' : 'Nueva Sucursal'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {editingStore ? 'Modifica los datos de la sucursal' : 'Crea una nueva sucursal'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Sucursal Centro"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                                    Zona
                                </label>
                                <select
                                    value={formData.zone_id}
                                    onChange={(e) => setFormData({ ...formData, zone_id: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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

                        <div className="flex gap-3 justify-end mt-6">
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingStore ? 'Guardar Cambios' : 'Crear Sucursal'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Store Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Eliminar Sucursal</h3>
                                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-4">
                            ¿Estás seguro de que deseas eliminar la sucursal <span className="font-semibold text-gray-900">"{deleteModal.name}"</span>?
                        </p>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-amber-700">
                                    No se puede eliminar una sucursal que tenga usuarios asignados o auditorías asociadas.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteModal(null)}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteStore}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar Sucursal
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
