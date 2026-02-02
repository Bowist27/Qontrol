import { useState, useEffect, useCallback } from 'react';
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
    Lock,
    Building2,
    AlertCircle,
} from 'lucide-react';
import usersApi, {
    type User,
    type Store,
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
                    <h1 className="text-2xl font-bold text-white">Gestión de Acceso (IAM)</h1>
                    <p className="text-gray-400 mt-1">Administra usuarios, roles y permisos del sistema</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                        activeTab === 'users'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                        activeTab === 'roles'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    <Shield className="w-4 h-4" />
                    Roles
                </button>
            </div>

            {/* Content */}
            {activeTab === 'users' ? <UsersTab /> : <RolesTab />}
        </div>
    );
}

// =====================================================
// USERS TAB
// =====================================================
function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
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
            const [usersData, storesData, rolesData] = await Promise.all([
                usersApi.getUsers(),
                usersApi.getStores(),
                usersApi.getRoles(),
            ]);
            setUsers(usersData);
            setStores(storesData);
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

    const handleUpdateUser = async (userId: string, updates: Partial<UpdateUserRequest>) => {
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
            setEditingUserId(null);
            setEditingField(null);
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <button
                    onClick={() => setShowNewUser(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    onCancel={() => setShowNewUser(false)}
                    onSave={async (data) => {
                        await usersApi.createUser(data);
                        await loadData();
                        setShowNewUser(false);
                    }}
                />
            )}

            {/* Users Table */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-900">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usuario</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rol</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tiendas</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {filteredUsers.map((user) => (
                            <UserRow
                                key={user.id}
                                user={user}
                                roles={roles}
                                stores={stores}
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
                                onBan={() => setBanModal({ userId: user.id, email: user.email })}
                                onUnban={() => handleUnban(user.id)}
                                onDelete={() => handleDeleteUser(user.id, user.email)}
                            />
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        No se encontraron usuarios
                    </div>
                )}
            </div>

            {/* Ban Modal */}
            {banModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-4">Banear Usuario</h3>
                        <p className="text-gray-400 mb-4">
                            ¿Banear a <span className="text-white font-medium">{banModal.email}</span>?
                        </p>
                        <textarea
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            placeholder="Razón del baneo (requerido)"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setBanModal(null);
                                    setBanReason('');
                                }}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
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
    stores: Store[];
    isEditing: boolean;
    editingField: string | null;
    onStartEdit: (field: string) => void;
    onCancelEdit: () => void;
    onUpdate: (updates: Partial<UpdateUserRequest>) => void;
    onBan: () => void;
    onUnban: () => void;
    onDelete: () => void;
}

function UserRow({
    user,
    roles,
    stores,
    isEditing,
    editingField,
    onStartEdit,
    onCancelEdit,
    onUpdate,
    onBan,
    onUnban,
    onDelete,
}: UserRowProps) {
    const [localRoleId, setLocalRoleId] = useState(user.role_id);
    const [localStoreIds, setLocalStoreIds] = useState((user.stores || []).map((s) => s.id));
    const [showStoresDropdown, setShowStoresDropdown] = useState(false);

    const isBanned = !!user.banned_at;
    const currentRole = roles.find((r) => r.id === user.role_id);
    const userStores = user.stores || [];

    return (
        <tr className={`${isBanned ? 'opacity-60' : ''} hover:bg-gray-750`}>
            {/* Name */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div>
                        <div className="text-white font-medium">
                            {user.first_name} {user.last_name}
                        </div>
                        {isBanned && (
                            <div className="text-xs text-red-400 flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                {user.banned_reason}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            {/* Email */}
            <td className="px-4 py-3 text-gray-300">{user.email}</td>

            {/* Role - Editable Dropdown */}
            <td className="px-4 py-3">
                {isEditing && editingField === 'role' ? (
                    <div className="flex items-center gap-2">
                        <select
                            value={localRoleId}
                            onChange={(e) => setLocalRoleId(Number(e.target.value))}
                            className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                        >
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => onUpdate({ role_id: localRoleId })}
                            className="p-1 text-green-400 hover:text-green-300"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                        <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:text-gray-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => onStartEdit('role')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
                    >
                        <Shield className="w-3 h-3" />
                        {currentRole?.name || 'Sin rol'}
                        <ChevronDown className="w-3 h-3" />
                    </button>
                )}
            </td>

            {/* Stores - Editable Multi-select */}
            <td className="px-4 py-3 relative">
                {isEditing && editingField === 'stores' ? (
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => onUpdate({ store_ids: localStoreIds })}
                                className="p-1 text-green-400 hover:text-green-300"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                            <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:text-gray-300">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="absolute z-10 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                            {stores.map((store) => (
                                <label
                                    key={store.id}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={localStoreIds.includes(store.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setLocalStoreIds([...localStoreIds, store.id]);
                                            } else {
                                                setLocalStoreIds(localStoreIds.filter((id) => id !== store.id));
                                            }
                                        }}
                                        className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-300">{store.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            setLocalStoreIds((user.stores || []).map((s) => s.id));
                            onStartEdit('stores');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
                    >
                        <Building2 className="w-3 h-3" />
                        {userStores.length > 0 ? `${userStores.length} tienda(s)` : 'Ninguna'}
                        <ChevronDown className="w-3 h-3" />
                    </button>
                )}
            </td>

            {/* Status */}
            <td className="px-4 py-3">
                {isBanned ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                        <Ban className="w-3 h-3" />
                        Baneado
                    </span>
                ) : user.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Activo
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs">
                        Inactivo
                    </span>
                )}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                    {isBanned ? (
                        <button
                            onClick={onUnban}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                            title="Desbanear"
                        >
                            <CheckCircle className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={onBan}
                            className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors"
                            title="Banear"
                        >
                            <Ban className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onDelete}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
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
    stores: Store[];
    onCancel: () => void;
    onSave: (data: CreateUserRequest) => Promise<void>;
}

function NewUserForm({ roles, stores, onCancel, onSave }: NewUserFormProps) {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role_id: roles[0]?.id || 1,
        store_ids: [] as number[],
        permissions: [] as string[],
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.password || !formData.first_name) {
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
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-4">
                <input
                    type="text"
                    placeholder="Nombre *"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="col-span-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                    type="text"
                    placeholder="Apellido"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="col-span-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                    type="email"
                    placeholder="Email *"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="col-span-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                    type="password"
                    placeholder="Contraseña *"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="col-span-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: Number(e.target.value) })}
                    className="col-span-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Crear'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <p className="text-gray-400">
                    Define roles personalizados con permisos específicos. Los roles del sistema no pueden modificarse.
                </p>
                <button
                    onClick={() => setShowNewRole(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                        className={`bg-gray-800 rounded-lg border ${
                            role.is_system ? 'border-blue-500/30' : 'border-gray-700'
                        } p-4`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-white font-semibold">{role.name}</h3>
                                    {role.is_system && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                                            <Lock className="w-3 h-3" />
                                            Sistema
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm mt-1">{role.description}</p>
                            </div>
                            {!role.is_system && (
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setEditingRole(role)}
                                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                    >
                                        <Shield className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRole(role)}
                                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Permissions */}
                        <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase font-medium">Permisos</div>
                            <div className="flex flex-wrap gap-1">
                                {role.permissions.length > 0 ? (
                                    role.permissions.map((perm) => (
                                        <span
                                            key={perm}
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                                perm.startsWith('web:')
                                                    ? 'bg-purple-500/20 text-purple-400'
                                                    : 'bg-green-500/20 text-green-400'
                                            }`}
                                        >
                                            {perm.split(':')[1]}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-500 text-xs flex items-center gap-1">
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
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
                {role ? 'Editar Rol' : 'Nuevo Rol'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nombre</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            placeholder="Ej: Supervisor"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Descripción</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            placeholder="Ej: Acceso a reportes y auditorías"
                        />
                    </div>
                </div>

                {/* Permissions */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Permisos</label>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Web Permissions */}
                        <div className="bg-gray-900 rounded-lg p-4">
                            <div className="text-purple-400 text-sm font-medium mb-3 flex items-center gap-2">
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
                                            className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                                        />
                                        <div>
                                            <div className="text-white text-sm">{perm.label}</div>
                                            <div className="text-gray-500 text-xs">{perm.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* POS Permissions */}
                        <div className="bg-gray-900 rounded-lg p-4">
                            <div className="text-green-400 text-sm font-medium mb-3 flex items-center gap-2">
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
                                            className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500"
                                        />
                                        <div>
                                            <div className="text-white text-sm">{perm.label}</div>
                                            <div className="text-gray-500 text-xs">{perm.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : role ? 'Guardar Cambios' : 'Crear Rol'}
                    </button>
                </div>
            </form>
        </div>
    );
}
