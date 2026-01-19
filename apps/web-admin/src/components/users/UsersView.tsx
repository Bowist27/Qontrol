/**
 * UsersView Component
 * User management (IAM) view
 */

import { Plus } from 'lucide-react';

const UsersView: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Usuarios (IAM)</h2>
                <button
                    className="text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90"
                    style={{ backgroundColor: '#06aef0' }}
                >
                    <Plus size={18} /> Crear Usuario
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                            <th className="px-6 py-3">Usuario</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Rol</th>
                            <th className="px-6 py-3">Tienda Asignada</th>
                            <th className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="px-6 py-4 font-medium">Jose Admin</td>
                            <td className="px-6 py-4 text-slate-500">jose.admin@comex.com</td>
                            <td className="px-6 py-4">
                                <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-300">
                                    ADMINISTRADOR
                                </span>
                            </td>
                            <td className="px-6 py-4">Todas</td>
                            <td className="px-6 py-4 text-right cursor-pointer" style={{ color: '#06aef0' }}>
                                Editar
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 font-medium">Juan Cajero</td>
                            <td className="px-6 py-4 text-slate-500">juan.c@comex.com</td>
                            <td className="px-6 py-4">
                                <span
                                    className="px-2 py-1 rounded text-xs border"
                                    style={{ backgroundColor: '#e6f7fd', color: '#06aef0', borderColor: '#b3e6f9' }}
                                >
                                    VENDEDOR
                                </span>
                            </td>
                            <td className="px-6 py-4">Sucursal Celaya</td>
                            <td className="px-6 py-4 text-right cursor-pointer" style={{ color: '#06aef0' }}>
                                Editar
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UsersView;
