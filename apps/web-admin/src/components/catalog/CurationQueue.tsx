/**
 * CurationQueue Component
 * "Cola de Curación" - Shows provisional products pending validation
 */

import { useState } from 'react';
import { AlertCircle, Check, X, MapPin, Calendar, Package, ChevronDown } from 'lucide-react';
import { PROVISIONAL_PRODUCTS } from '../../data/mockData';
import type { ProvisionalProduct, ProductFamily, Presentation } from '../../types';

const FAMILIES: ProductFamily[] = ['Vinílicas', 'Esmaltes', 'Impermeabilizantes', 'Accesorios', 'Selladores'];
const PRESENTATIONS: Presentation[] = ['1L', '4L', '19L', 'Tambor', 'Pieza'];

interface EditingProduct extends ProvisionalProduct {
    correctedName: string;
    selectedFamily: ProductFamily | '';
    selectedPresentation: Presentation | '';
    correctedPrice: string;
}

const CurationQueue: React.FC = () => {
    const [products, setProducts] = useState<ProvisionalProduct[]>(PROVISIONAL_PRODUCTS);
    const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);

    const handleStartEdit = (product: ProvisionalProduct) => {
        setEditingProduct({
            ...product,
            correctedName: product.originalName,
            selectedFamily: product.suggestedFamily || '',
            selectedPresentation: '',
            correctedPrice: product.suggestedPrice?.toString() || '',
        });
    };

    const handleValidate = () => {
        if (!editingProduct) return;

        // Simular validación - en producción llamaría a API
        console.log('Validando producto:', {
            sku: editingProduct.sku,
            name: editingProduct.correctedName,
            family: editingProduct.selectedFamily,
            presentation: editingProduct.selectedPresentation,
            price: parseFloat(editingProduct.correctedPrice) || 0,
        });

        // Remover de la lista
        setProducts(prev => prev.filter(p => p.sku !== editingProduct.sku));
        setEditingProduct(null);
    };

    const handleReject = (sku: string) => {
        // Simular rechazo
        setProducts(prev => prev.filter(p => p.sku !== sku));
        if (editingProduct?.sku === sku) {
            setEditingProduct(null);
        }
    };

    if (products.length === 0) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                <Check size={48} className="mx-auto text-emerald-500 mb-4" />
                <h3 className="text-lg font-bold text-emerald-800">¡Todo limpio!</h3>
                <p className="text-emerald-600">No hay productos pendientes de validar.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Alert Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium text-amber-800">
                        {products.length} {products.length === 1 ? 'producto descubierto' : 'productos descubiertos'} en reportes de tiendas
                    </p>
                    <p className="text-sm text-amber-700">
                        Estos SKUs aparecieron en inventarios pero no existen en el catálogo. Revisa y valida cada uno para oficializarlo.
                    </p>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-medium w-28">SKU</th>
                            <th className="px-4 py-3 font-medium">Nombre Original</th>
                            <th className="px-4 py-3 font-medium w-40">Origen</th>
                            <th className="px-4 py-3 font-medium w-32">Fecha</th>
                            <th className="px-4 py-3 font-medium w-24 text-center">Stock</th>
                            <th className="px-4 py-3 font-medium w-32 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map((product) => (
                            <tr
                                key={product.sku}
                                className={`hover:bg-slate-50 transition-colors ${editingProduct?.sku === product.sku ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <td className="px-4 py-3">
                                    <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                                        {product.sku}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-800">{product.originalName}</span>
                                        {product.suggestedFamily && (
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                                {product.suggestedFamily}?
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1 text-slate-600">
                                        <MapPin size={14} className="text-slate-400" />
                                        {product.sourceStoreName}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1 text-slate-500 text-xs">
                                        <Calendar size={12} />
                                        {product.discoveredAt}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-700">
                                        <Package size={14} />
                                        {product.initialStock}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => handleStartEdit(product)}
                                            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90"
                                            style={{ backgroundColor: '#06aef0' }}
                                        >
                                            Validar
                                        </button>
                                        <button
                                            onClick={() => handleReject(product.sku)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                            title="Rechazar / Ignorar"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Validar Producto</h3>
                                    <p className="text-sm text-slate-500">SKU: {editingProduct.sku}</p>
                                </div>
                                <button
                                    onClick={() => setEditingProduct(null)}
                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                >
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="p-6 space-y-4">
                            {/* Original Name */}
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Nombre en el Excel:</p>
                                <p className="font-mono text-slate-700">{editingProduct.originalName}</p>
                            </div>

                            {/* Corrected Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nombre Oficial *
                                </label>
                                <input
                                    type="text"
                                    value={editingProduct.correctedName}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, correctedName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: Brocha Profesional 2 pulgadas"
                                />
                            </div>

                            {/* Family */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Familia *
                                </label>
                                <div className="relative">
                                    <select
                                        value={editingProduct.selectedFamily}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, selectedFamily: e.target.value as ProductFamily })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                    >
                                        <option value="">Selecciona familia...</option>
                                        {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Presentation */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Presentación *
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {PRESENTATIONS.map(pres => (
                                        <button
                                            key={pres}
                                            onClick={() => setEditingProduct({ ...editingProduct, selectedPresentation: pres })}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${editingProduct.selectedPresentation === pres
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {pres}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Price */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Precio (MXN) *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                    <input
                                        type="number"
                                        value={editingProduct.correctedPrice}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, correctedPrice: e.target.value })}
                                        className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingProduct(null)}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleValidate}
                                disabled={!editingProduct.correctedName || !editingProduct.selectedFamily || !editingProduct.selectedPresentation || !editingProduct.correctedPrice}
                                className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#06aef0' }}
                            >
                                <Check size={16} className="inline mr-2" />
                                Oficializar Producto
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CurationQueue;
