/**
 * StockPopover Component
 * "Eye of God" - Shows stock availability across all stores
 */

import { MapPin, Package, Truck } from 'lucide-react';
import { STORES_DATA, getStockStatus } from '../../data/mockData';
import type { ProductWithStock } from '../../types';

interface StockPopoverProps {
    product: ProductWithStock;
    onClose: () => void;
}

const StockPopover: React.FC<StockPopoverProps> = ({ product, onClose }) => {
    return (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 text-white px-4 py-3">
                <div className="font-bold text-sm">{product.name}</div>
                <div className="text-xs text-slate-300">{product.color} • {product.presentation}</div>
            </div>

            {/* Stock by store */}
            <div className="max-h-48 overflow-y-auto">
                {product.stockByStore
                    .sort((a, b) => b.stock - a.stock)
                    .map((storeStock) => {
                        const store = STORES_DATA.find(s => s.id === storeStock.storeId);
                        const status = getStockStatus(storeStock.stock, storeStock.minStock, storeStock.maxStock);
                        return (
                            <div key={storeStock.storeId} className="px-4 py-2 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center gap-2">
                                    {storeStock.storeId === 31 ? (
                                        <Package size={14} className="text-slate-400" />
                                    ) : (
                                        <MapPin size={14} className="text-slate-400" />
                                    )}
                                    <span className="text-sm text-slate-700">{store?.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-sm ${status === 'critical' ? 'text-red-600'
                                            : status === 'low' ? 'text-amber-600'
                                                : 'text-emerald-600'
                                        }`}>
                                        {storeStock.stock} pzs
                                    </span>
                                    {storeStock.inTransit > 0 && (
                                        <span className="text-xs text-blue-600 flex items-center gap-1">
                                            <Truck size={12} /> +{storeStock.inTransit}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center cursor-pointer" onClick={onClose}>
                Clic para cerrar
            </div>
        </div>
    );
};

export default StockPopover;
