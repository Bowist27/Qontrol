/**
 * StoresView Component
 * Manage stores/tiendas - CRUD operations
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
} from 'lucide-react';
import usersApi, { type Store as StoreType } from '../../services/users.api';

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function StoresView() {
    const [stores, setStores] = useState<StoreType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewStore, setShowNewStore] = useState(false);
    const [editingStore, setEditingStore] = useState<StoreType | null>(null);
    const [newStoreName, setNewStoreName] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStores = useCallback(async () => {
        try {
            setLoading(true);
            const storesData = await usersApi.getStores();
            setStores(storesData);
        } catch (error) {
            console.error('Error loading stores:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStores();
    }, [loadStores]);

    const filteredStores = stores.filter(store =>
        store.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateStore = async () => {
        if (!newStoreName.trim()) return;
        
        try {
            setSaving(true);
            setError(null);
            await usersApi.createStore({ name: newStoreName.trim() });
            setNewStoreName('');
            setShowNewStore(false);
            await loadStores();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al crear tienda');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStore = async (store: StoreType) => {
        try {
            setSaving(true);
            setError(null);
            await usersApi.updateStore(store.id, { name: store.name, status: store.status });
            setEditingStore(null);
            await loadStores();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'Error al actualizar tienda');
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
            await loadStores();
        } catch (error: unknown) {
            const err = error as { message?: string };
            setError(err.message || 'No se puede eliminar: la tienda está en uso');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (store: StoreType) => {
        try {
            await usersApi.updateStore(store.id, { name: store.name, status: !store.status });
            await loadStores();
        } catch (error) {
            console.error('Error toggling store status:', error);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestión de Tiendas</h1>
                    <p className="text-slate-500 mt-1">Administra las tiendas del sistema</p>
                </div>
            </div>

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
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
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
                    Nueva Tienda
                </button>
            </div>

            {/* New Store Form */}
            {showNewStore && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-600" />
                        Nueva Tienda
                    </h3>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={newStoreName}
                            onChange={(e) => setNewStoreName(e.target.value)}
                            placeholder="Nombre de la tienda"
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <button
                            onClick={handleCreateStore}
                            disabled={saving || !newStoreName.trim()}
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
                                setNewStoreName('');
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
                                Tienda
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
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm ? 'No se encontraron tiendas' : 'No hay tiendas registradas'}
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
                                                className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                                    {store.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-800">{store.name}</span>
                                            </div>
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
                    <p className="font-medium">Información sobre tiendas</p>
                    <p className="mt-1">Las tiendas se utilizan para organizar auditorías y asignar usuarios. No se pueden eliminar tiendas que tengan usuarios asignados o auditorías asociadas.</p>
                </div>
            </div>
        </div>
    );
}
