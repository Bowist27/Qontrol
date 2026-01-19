/**
 * AuditHistory Component
 * History log of all audit imports
 */

import { AUDIT_LOGS } from '../../data/mockData';

const AuditHistory: React.FC = () => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Historial de Importaciones</h3>
                <p className="text-sm text-slate-500">Registro de todas las cargas de inventario realizadas</p>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 font-medium">Fecha</th>
                        <th className="px-4 py-3 font-medium">Usuario</th>
                        <th className="px-4 py-3 font-medium">Tienda</th>
                        <th className="px-4 py-3 font-medium">Archivo</th>
                        <th className="px-4 py-3 font-medium text-center">Productos</th>
                        <th className="px-4 py-3 font-medium text-center">Estado</th>
                        <th className="px-4 py-3 font-medium text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {AUDIT_LOGS.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">{log.date}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{log.user}</td>
                            <td className="px-4 py-3 text-slate-600">{log.storeName}</td>
                            <td className="px-4 py-3">
                                <span className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{log.fileName}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-800">{log.productsUpdated}</td>
                            <td className="px-4 py-3 text-center">
                                {log.status === 'applied' && (
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Aplicado</span>
                                )}
                                {log.status === 'cancelled' && (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Cancelado</span>
                                )}
                                {log.status === 'pending' && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Pendiente</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button className="text-xs font-medium hover:underline" style={{ color: '#06aef0' }}>
                                    Descargar Original
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AuditHistory;
