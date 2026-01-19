/**
 * CatalogView Component
 * Catalog upload and management view
 */

import { AlertTriangle, FileSpreadsheet, Upload, Download } from 'lucide-react';
import { PRODUCTS_CATALOG } from '../../data/mockData';

const CatalogView: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium text-amber-800">Zona de Configuración Global</p>
                    <p className="text-sm text-amber-700">
                        Los cambios aquí afectan a <strong>todas las 31 tiendas</strong>. Solo usa esta sección para agregar productos nuevos o actualizar precios.
                        Para ajustar cantidades, usa la sección de Auditorías.
                    </p>
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-8">
                <div className="max-w-2xl mx-auto text-center">
                    <FileSpreadsheet size={48} className="mx-auto text-slate-400 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Actualizar Catálogo de Productos</h3>
                    <p className="text-slate-500 mb-6">
                        Sube un archivo Excel con SKU, Nombre, Precio y Familia. El sistema actualizará los productos existentes y creará los nuevos.
                        <strong className="text-slate-700"> No se modifican cantidades.</strong>
                    </p>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-blue-400 cursor-pointer hover:bg-blue-50 transition-colors">
                        <Upload size={40} className="mx-auto text-slate-400 mb-3" />
                        <p className="font-medium text-slate-700">Clic para seleccionar archivo de catálogo</p>
                        <p className="text-xs text-slate-400 mt-1">Columnas esperadas: SKU, Nombre, Precio, Familia, Presentación</p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <p className="text-sm text-slate-500 mb-3">O descarga la plantilla de ejemplo:</p>
                        <button className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2">
                            <Download size={16} /> Descargar Plantilla Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Total Productos</p>
                    <p className="text-2xl font-bold text-slate-800">{PRODUCTS_CATALOG.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Familias</p>
                    <p className="text-2xl font-bold text-slate-800">5</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Última Actualización</p>
                    <p className="text-2xl font-bold text-slate-800">Ene 15</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Por:</p>
                    <p className="text-2xl font-bold text-slate-800">Adrián G.</p>
                </div>
            </div>
        </div>
    );
};

export default CatalogView;
