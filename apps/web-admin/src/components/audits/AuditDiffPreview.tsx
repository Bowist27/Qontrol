/**
 * AuditDiffPreview Component
 * Step 2: Preview comparison before applying
 */

import { CheckCircle2, ArrowUpCircle, ArrowDownCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { STORES_DATA, AUDIT_DIFF_PREVIEW } from '../../data/mockData';

interface AuditDiffPreviewProps {
    storeId: number;
    fileName: string;
    onBack: () => void;
    onApply: () => void;
    onCancel: () => void;
}

const AuditDiffPreview: React.FC<AuditDiffPreviewProps> = ({
    storeId,
    fileName,
    onBack,
    onApply,
    onCancel,
}) => {
    const store = STORES_DATA.find(s => s.id === storeId);

    const diffStats = {
        ok: AUDIT_DIFF_PREVIEW.filter(i => i.action === 'ok').length,
        adjustUp: AUDIT_DIFF_PREVIEW.filter(i => i.action === 'adjust_up').length,
        adjustDown: AUDIT_DIFF_PREVIEW.filter(i => i.action === 'adjust_down').length,
        newProducts: AUDIT_DIFF_PREVIEW.filter(i => i.action === 'new_product').length,
    };

    const totalChanges = AUDIT_DIFF_PREVIEW.filter(i => i.action !== 'ok').length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-800">
                        ← Volver
                    </button>
                    <div className="border-l border-slate-200 pl-4">
                        <p className="text-sm text-slate-500">Comparando inventario de:</p>
                        <p className="font-bold text-slate-800">{store?.name} • {fileName}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onApply}
                        className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90"
                        style={{ backgroundColor: '#06aef0' }}
                    >
                        <CheckCircle2 size={18} className="inline mr-2" />
                        Aplicar {totalChanges} Cambios
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                        <CheckCircle2 size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{diffStats.ok}</p>
                        <p className="text-xs text-slate-500">Sin cambios</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                        <ArrowUpCircle size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{diffStats.adjustUp}</p>
                        <p className="text-xs text-slate-500">Entradas</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                        <ArrowDownCircle size={20} className="text-red-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{diffStats.adjustDown}</p>
                        <p className="text-xs text-slate-500">Mermas/Pérdidas</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                        <AlertCircle size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{diffStats.newProducts}</p>
                        <p className="text-xs text-slate-500">Productos Nuevos</p>
                    </div>
                </div>
            </div>

            {/* Diff Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-medium w-28">SKU</th>
                            <th className="px-4 py-3 font-medium">Producto</th>
                            <th className="px-4 py-3 font-medium w-28 text-center">En Sistema</th>
                            <th className="px-4 py-3 font-medium w-28 text-center">En Archivo</th>
                            <th className="px-4 py-3 font-medium w-28 text-center">Diferencia</th>
                            <th className="px-4 py-3 font-medium w-40">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {AUDIT_DIFF_PREVIEW.map((item) => (
                            <tr
                                key={item.sku}
                                className={`hover:bg-slate-50 ${item.action === 'new_product' ? 'bg-purple-50' :
                                        item.action === 'adjust_down' ? 'bg-red-50' : ''
                                    }`}
                            >
                                <td className="px-4 py-3">
                                    <span className="font-mono text-xs text-slate-600">{item.sku}</span>
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                                <td className="px-4 py-3 text-center text-slate-600">
                                    {item.action === 'new_product' ? '—' : item.systemQty}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-slate-800">{item.fileQty}</td>
                                <td className="px-4 py-3 text-center">
                                    {item.difference === 0 ? (
                                        <span className="text-slate-400">—</span>
                                    ) : item.difference > 0 ? (
                                        <span className="text-emerald-600 font-bold">+{item.difference}</span>
                                    ) : (
                                        <span className="text-red-600 font-bold">{item.difference}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {item.action === 'ok' && (
                                        <span className="flex items-center gap-1 text-emerald-600 text-xs">
                                            <CheckCircle2 size={14} /> Sin cambios
                                        </span>
                                    )}
                                    {item.action === 'adjust_up' && (
                                        <span className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                                            <ArrowUpCircle size={14} /> Ajustar (Entrada)
                                        </span>
                                    )}
                                    {item.action === 'adjust_down' && (
                                        <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                                            <ArrowDownCircle size={14} /> Ajustar (Merma)
                                        </span>
                                    )}
                                    {item.action === 'new_product' && (
                                        <span className="flex items-center gap-1 text-purple-600 text-xs font-medium">
                                            <AlertCircle size={14} /> Producto Nuevo
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium text-amber-800">Revisa antes de aplicar</p>
                    <p className="text-sm text-amber-700">
                        Si ves diferencias muy grandes (ej. +500 o -500), verifica que el archivo corresponda a la tienda correcta.
                        Una vez aplicados, los cambios quedarán registrados en la bitácora.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuditDiffPreview;
