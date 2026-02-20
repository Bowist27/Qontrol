import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users,
    Shield,
    Plus,
    Trash2,
    Ban,
    CheckCircle,
    Search,
    Save,
    X,
    ChevronDown,
    ChevronRight,
    ArrowLeft,
    Lock,
    Building2,
    AlertCircle,
    MapPin,
} from 'lucide-react';
import usersApi, {
    type User,
    type Store as StoreType,
    type Zone as ZoneType,
    type Role,
    type CreateUserRequest,
    type UpdateUserRequest,
    AVAILABLE_PERMISSIONS,
} from '../../services/users.api';

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function UsersView() {
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestión de Acceso (IAM)</h1>
                    <p className="text-slate-500 mt-1">Administra usuarios, roles y permisos del sistema</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                        activeTab === 'users'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                        activeTab === 'roles'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Shield className="w-4 h-4" />
                    Roles
                </button>
            </div>

            {/* Content */}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'roles' && <RolesTab />}
        </div>
    );
}

// =====================================================
// USERS TAB
// =====================================================
function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [stores, setStores] = useState<StoreType[]>([]);
    const [zones, setZones] = useState<ZoneType[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [showNewUser, setShowNewUser] = useState(false);
    const [banModal, setBanModal] = useState<{ userId: string; email: string } | null>(null);
    const [banReason, setBanReason] = useState('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [usersData, storesData, rolesData, zonesData] = await Promise.all([
                usersApi.getUsers(),
                usersApi.getStores(),
                usersApi.getRoles(),
                usersApi.getZones(),
            ]);
            setUsers(usersData);
            setStores(storesData);
            setZones(zonesData);
            setRoles(rolesData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredUsers = users.filter(
        (user) =>
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUpdateUser = async (userId: string, updates: Partial<UpdateUserRequest>, keepOpen = false) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;

        try {
            const updateData: UpdateUserRequest = {
                email: updates.email ?? user.email,
                first_name: updates.first_name ?? user.first_name,
                last_name: updates.last_name ?? user.last_name,
                role_id: updates.role_id ?? user.role_id,
                is_active: updates.is_active ?? user.is_active,
                store_ids: updates.store_ids ?? (user.stores || []).map((s) => s.id),
                permissions: updates.permissions ?? (user.permissions || []),
            };

            await usersApi.updateUser(userId, updateData);
            await loadData();
            if (!keepOpen) {
                setEditingUserId(null);
                setEditingField(null);
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error al actualizar usuario');
        }
    };

    const handleBan = async () => {
        if (!banModal || !banReason.trim()) return;
        try {
            await usersApi.banUser(banModal.userId, banReason);
            await loadData();
            setBanModal(null);
            setBanReason('');
        } catch (error) {
            console.error('Error banning user:', error);
            alert('Error al banear usuario');
        }
    };

    const handleUnban = async (userId: string) => {
        try {
            await usersApi.unbanUser(userId);
            await loadData();
        } catch (error) {
            console.error('Error unbanning user:', error);
            alert('Error al desbanear usuario');
        }
    };

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`¿Eliminar usuario ${email}? Esta acción no se puede deshacer.`)) return;
        try {
            await usersApi.deleteUser(userId);
            await loadData();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error al eliminar usuario');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={() => setShowNewUser(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Usuario
                </button>
            </div>

            {/* New User Form */}
            {showNewUser && (
                <NewUserForm
                    roles={roles}
                    stores={stores}
                    zones={zones}
                    onCancel={() => setShowNewUser(false)}
                    onSave={async (data) => {
                        await usersApi.createUser(data);
                        await loadData();
                        setShowNewUser(false);
                    }}
                />
            )}

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Usuario</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rol</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tiendas</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((user) => (
                            <UserRow
                                key={user.id}
                                user={user}
                                roles={roles}
                                stores={stores}
                                zones={zones}
                                isEditing={editingUserId === user.id}
                                editingField={editingField}
                                onStartEdit={(field) => {
                                    setEditingUserId(user.id);
                                    setEditingField(field);
                                }}
                                onCancelEdit={() => {
                                    setEditingUserId(null);
                                    setEditingField(null);
                                }}
                                onUpdate={(updates) => handleUpdateUser(user.id, updates)}
                                onUpdateKeepOpen={(updates) => handleUpdateUser(user.id, updates, true)}
                                onBan={() => setBanModal({ userId: user.id, email: user.email })}
                                onUnban={() => handleUnban(user.id)}
                                onDelete={() => handleDeleteUser(user.id, user.email)}
                            />
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        No se encontraron usuarios
                    </div>
                )}
            </div>

            {/* Ban Modal */}
            {banModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md border border-slate-200 shadow-xl">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Banear Usuario</h3>
                        <p className="text-slate-600 mb-4">
                            ¿Banear a <span className="text-slate-800 font-medium">{banModal.email}</span>?
                        </p>
                        <textarea
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            placeholder="Razón del baneo (requerido)"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setBanModal(null);
                                    setBanReason('');
                                }}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBan}
                                disabled={!banReason.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Banear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================
// USER ROW COMPONENT (Inline Editing)
// =====================================================
interface UserRowProps {
    user: User;
    roles: Role[];
    stores: StoreType[];
    zones: ZoneType[];
    isEditing: boolean;
    editingField: string | null;
    onStartEdit: (field: string) => void;
    onCancelEdit: () => void;
    onUpdate: (updates: Partial<UpdateUserRequest>) => void;
    onUpdateKeepOpen: (updates: Partial<UpdateUserRequest>) => void;
    onBan: () => void;
    onUnban: () => void;
    onDelete: () => void;
}

function UserRow({
    user,
    roles,
    stores,
    zones,
    isEditing,
    editingField,
    onStartEdit,
    onCancelEdit,
    onUpdate,
    onUpdateKeepOpen,
    onBan,
    onUnban,
    onDelete,
}: UserRowProps) {
    const [localRoleId, setLocalRoleId] = useState(user.role_id);
    const [localStoreIds, setLocalStoreIds] = useState((user.stores || []).map((s) => s.id));
    const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
    const storesDropdownRef = useRef<HTMLDivElement>(null);

    // Sync localStoreIds when user.stores reference changes (after server refresh)
    const storeIdsKey = (user.stores || []).map((s) => s.id).sort().join(',');
    useEffect(() => {
        setLocalStoreIds((user.stores || []).map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeIdsKey]);

    const isBanned = !!user.banned_at;
    const isSystemAdmin = user.id === 'a0000000-0000-0000-0000-000000000001';
    const currentRole = roles.find((r) => r.id === user.role_id);
    const userStores = user.stores || [];

    return (
        <tr className={`${isBanned ? 'opacity-60 bg-red-50/50' : 'hover:bg-slate-50'} transition-colors`}>
            {/* Name */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                        {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div>
                        <div className="text-slate-800 font-medium">
                            {user.first_name} {user.last_name}
                        </div>
                        {isBanned && (
                            <div className="text-xs text-red-600 flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                {user.banned_reason}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            {/* Email */}
            <td className="px-4 py-3 text-slate-600">{user.email}</td>

            {/* Role - Custom dropdown styled like stores */}
            <td className="px-4 py-3 relative">
                {isBanned || isSystemAdmin ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed">
                        <Shield className="w-3.5 h-3.5 text-slate-300" />
                        {currentRole?.name || 'Sin rol'}
                    </span>
                ) : isEditing && editingField === 'role' ? (
                    <div className="relative">
                        <button
                            onClick={onCancelEdit}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 transition-colors text-sm font-medium"
                        >
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                            {currentRole?.name || 'Sin rol'}
                            <X className="w-3 h-3 text-blue-400" />
                        </button>
                        <div className="absolute z-10 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-auto">
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => {
                                        setLocalRoleId(role.id);
                                        onUpdate({ role_id: role.id });
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                                        role.id === user.role_id
                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <Shield className={`w-3.5 h-3.5 ${role.id === user.role_id ? 'text-blue-500' : 'text-slate-400'}`} />
                                    {role.name}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => onStartEdit('role')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium"
                    >
                        <Shield className="w-3.5 h-3.5 text-slate-500" />
                        {currentRole?.name || 'Sin rol'}
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                )}
            </td>

            {/* Stores - Zone→Store drill-down (auto-save on toggle) */}
            <td className="px-4 py-3 relative">
                {isBanned ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed">
                        <Building2 className="w-3.5 h-3.5 text-slate-300" />
                        {userStores.length > 0 ? `${userStores.length} tienda(s)` : 'Ninguna'}
                    </span>
                ) : isEditing && editingField === 'stores' ? (
                    <div className="relative" ref={storesDropdownRef}>
                        <button
                            onClick={() => { setSelectedZoneId(null); onCancelEdit(); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 transition-colors text-sm font-medium"
                        >
                            <Building2 className="w-3.5 h-3.5 text-blue-500" />
                            {localStoreIds.length > 0 ? `${localStoreIds.length} tienda(s)` : 'Ninguna'}
                            <X className="w-3 h-3 text-blue-400" />
                        </button>
                        <div className="absolute z-10 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
                            {selectedZoneId === null ? (
                                /* Zone list */
                                <>
                                    <div className="px-3 py-2 border-b border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selecciona una zona</span>
                                    </div>
                                    {zones.map((zone) => {
                                        const zoneStores = stores.filter((s) => s.zone_id === zone.id);
                                        const assignedCount = zoneStores.filter((s) => localStoreIds.includes(s.id)).length;
                                        return (
                                            <button
                                                key={zone.id}
                                                onClick={() => setSelectedZoneId(zone.id)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-sm text-slate-700 font-medium">{zone.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {assignedCount > 0 && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                                            {assignedCount}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-400">{zoneStores.length}</span>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            ) : (
                                /* Stores within selected zone */
                                <>
                                    <button
                                        onClick={() => setSelectedZoneId(null)}
                                        className="w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            {zones.find((z) => z.id === selectedZoneId)?.name || 'Zona'}
                                        </span>
                                    </button>
                                    {stores.filter((s) => s.zone_id === selectedZoneId).map((store) => (
                                        <label
                                            key={store.id}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={localStoreIds.includes(store.id)}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...localStoreIds, store.id]
                                                        : localStoreIds.filter((id) => id !== store.id);
                                                    setLocalStoreIds(newIds);
                                                    onUpdateKeepOpen({ store_ids: newIds });
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700">{store.name}</span>
                                        </label>
                                    ))}
                                    {stores.filter((s) => s.zone_id === selectedZoneId).length === 0 && (
                                        <div className="px-3 py-3 text-xs text-slate-400 text-center">Sin tiendas en esta zona</div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            setLocalStoreIds((user.stores || []).map((s) => s.id));
                            setSelectedZoneId(null);
                            onStartEdit('stores');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium"
                    >
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        {userStores.length > 0 ? `${userStores.length} tienda(s)` : 'Ninguna'}
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                )}
            </td>

            {/* Status */}
            <td className="px-4 py-3">
                {isBanned ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                        <Ban className="w-3 h-3" />
                        Baneado
                    </span>
                ) : user.is_active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Activo
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        Inactivo
                    </span>
                )}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                    {isSystemAdmin ? (
                        <span className="text-xs text-slate-400 italic">Protegido</span>
                    ) : isBanned ? (
                        <>
                            <button
                                onClick={onUnban}
                                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                title="Desbanear"
                            >
                                <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Eliminar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onBan}
                                className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                title="Banear"
                            >
                                <Ban className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Eliminar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

// =====================================================
// NEW USER FORM
// =====================================================
interface NewUserFormProps {
    roles: Role[];
    stores: StoreType[];
    zones: ZoneType[];
    onCancel: () => void;
    onSave: (data: CreateUserRequest) => Promise<void>;
}

function NewUserForm({ roles, stores: _stores, zones: _zones, onCancel, onSave }: NewUserFormProps) {
    const [formData, setFormData] = useState({
        email: '',
        password: 'Test123!', // Default password - user will receive email to change it
        first_name: '',
        last_name: '',
        role_id: roles[0]?.id || 1,
        store_ids: [] as number[],
        permissions: [] as string[],
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.first_name) {
            alert('Completa los campos requeridos');
            return;
        }
        setSaving(true);
        try {
            await onSave(formData);
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Error al crear usuario');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-5 gap-4">
                    <input
                        type="text"
                        placeholder="Nombre *"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="col-span-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="text"
                        placeholder="Apellido"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="col-span-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="email"
                        placeholder="Email *"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="col-span-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={formData.role_id}
                        onChange={(e) => setFormData({ ...formData, role_id: Number(e.target.value) })}
                        className="col-span-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                    <div className="col-span-1 flex gap-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Crear'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Se enviará un correo de activación al usuario para que establezca su contraseña.</span>
                </div>
            </form>
        </div>
    );
}

// =====================================================
// ROLES TAB
// =====================================================
function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [showNewRole, setShowNewRole] = useState(false);

    const loadRoles = useCallback(async () => {
        try {
            setLoading(true);
            const data = await usersApi.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    const handleSaveRole = async (roleData: { name: string; description: string; permissions: string[] }) => {
        try {
            if (editingRole) {
                await usersApi.updateRole(editingRole.id, roleData);
            } else {
                await usersApi.createRole(roleData);
            }
            await loadRoles();
            setEditingRole(null);
            setShowNewRole(false);
        } catch (error) {
            console.error('Error saving role:', error);
            alert('Error al guardar rol');
        }
    };

    const handleDeleteRole = async (role: Role) => {
        if (role.is_system) {
            alert('Los roles del sistema no se pueden eliminar');
            return;
        }
        if (!confirm(`¿Eliminar rol "${role.name}"?`)) return;
        try {
            await usersApi.deleteRole(role.id);
            await loadRoles();
        } catch (error) {
            console.error('Error deleting role:', error);
            alert('Error al eliminar rol');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <p className="text-slate-500">
                    Define roles personalizados con permisos específicos. Los roles del sistema no pueden modificarse.
                </p>
                <button
                    onClick={() => setShowNewRole(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Rol
                </button>
            </div>

            {/* New/Edit Role Form */}
            {(showNewRole || editingRole) && (
                <RoleForm
                    role={editingRole}
                    onCancel={() => {
                        setShowNewRole(false);
                        setEditingRole(null);
                    }}
                    onSave={handleSaveRole}
                />
            )}

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                    <div
                        key={role.id}
                        className={`bg-white rounded-xl border ${
                            role.is_system ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'
                        } p-5 shadow-sm hover:shadow-md transition-shadow`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-slate-800 font-semibold">{role.name}</h3>
                                    {role.is_system && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                            <Lock className="w-3 h-3" />
                                            Sistema
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-500 text-sm mt-1">{role.description}</p>
                            </div>
                            {!role.is_system && (
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setEditingRole(role)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Shield className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRole(role)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Permissions */}
                        <div className="space-y-2">
                            <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Permisos</div>
                            <div className="flex flex-wrap gap-1.5">
                                {role.permissions.length > 0 ? (
                                    role.permissions.map((perm) => (
                                        <span
                                            key={perm}
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                perm.startsWith('web:')
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                            }`}
                                        >
                                            {perm.split(':')[1]}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-slate-400 text-xs flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Sin permisos
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// =====================================================
// ROLE FORM
// =====================================================
interface RoleFormProps {
    role: Role | null;
    onCancel: () => void;
    onSave: (data: { name: string; description: string; permissions: string[] }) => Promise<void>;
}

function RoleForm({ role, onCancel, onSave }: RoleFormProps) {
    const [formData, setFormData] = useState({
        name: role?.name || '',
        description: role?.description || '',
        permissions: role?.permissions || [],
    });
    const [saving, setSaving] = useState(false);

    const togglePermission = (perm: string) => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter((p) => p !== perm)
                : [...prev.permissions, perm],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('El nombre es requerido');
            return;
        }
        setSaving(true);
        try {
            await onSave(formData);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {role ? 'Editar Rol' : 'Nuevo Rol'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: Supervisor"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Descripción</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: Acceso a reportes y auditorías"
                        />
                    </div>
                </div>

                {/* Permissions */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Permisos</label>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Web Permissions */}
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                            <div className="text-purple-700 text-sm font-semibold mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Permisos Web
                            </div>
                            <div className="space-y-2">
                                {AVAILABLE_PERMISSIONS.web.map((perm) => (
                                    <label key={perm.key} className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.permissions.includes(perm.key)}
                                            onChange={() => togglePermission(perm.key)}
                                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div>
                                            <div className="text-slate-700 text-sm font-medium">{perm.label}</div>
                                            <div className="text-slate-500 text-xs">{perm.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* POS Permissions */}
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <div className="text-emerald-700 text-sm font-semibold mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Permisos POS
                            </div>
                            <div className="space-y-2">
                                {AVAILABLE_PERMISSIONS.pos.map((perm) => (
                                    <label key={perm.key} className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.permissions.includes(perm.key)}
                                            onChange={() => togglePermission(perm.key)}
                                            className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <div>
                                            <div className="text-slate-700 text-sm font-medium">{perm.label}</div>
                                            <div className="text-slate-500 text-xs">{perm.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : role ? 'Guardar Cambios' : 'Crear Rol'}
                    </button>
                </div>
            </form>
        </div>
    );
}
