/**
 * InventoryView Component
 * Complete inventory management view with filters, store selector, and product table
 */

import { useState, useRef, useEffect } from 'react';
import { Store, Search, Download, ChevronDown, Truck, Eye, MapPin } from 'lucide-react';
import { STORES_DATA, PRODUCTS_CATALOG, getStockStatus, getProductStockForStore } from '../../data/mockData';
import InventoryFilters from './InventoryFilters';
import StockPopover from './StockPopover';
import type { ProductFamily, Presentation, StockStatus, ProductWithStock } from '../../types';

const InventoryView: React.FC = () => {
    // State
    const [selectedStore, setSelectedStore] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [familyFilter, setFamilyFilter] = useState<ProductFamily | 'all'>('all');
    const [presentationFilter, setPresentationFilter] = useState<Presentation | 'all'>('all');
    const [stockFilter, setStockFilter] = useState<StockStatus | 'all'>('all');
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [storeSearch, setStoreSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

    const storeDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
                setShowStoreDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter stores for dropdown
    const filteredStoresForDropdown = STORES_DATA.filter(s =>
        s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
        s.city.toLowerCase().includes(storeSearch.toLowerCase())
    );

    // Filter products
    const filteredProducts = PRODUCTS_CATALOG.filter(product => {
        const matchesSearch = searchTerm === '' ||
            product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.color.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFamily = familyFilter === 'all' || product.family === familyFilter;
        const matchesPresentation = presentationFilter === 'all' || product.presentation === presentationFilter;
        const matchesStore = selectedStore === 'all' ||
            product.stockByStore.some(s => s.storeId === selectedStore);

        let matchesStockStatus = true;
        if (stockFilter !== 'all' && selectedStore !== 'all') {
            const storeStock = getProductStockForStore(product, selectedStore);
            if (storeStock) {
                const status = getStockStatus(storeStock.stock, storeStock.minStock, storeStock.maxStock);
                matchesStockStatus = status === stockFilter;
            }
        }

        return matchesSearch && matchesFamily && matchesPresentation && matchesStore && matchesStockStatus;
    });

    const clearFilters = () => {
        setFamilyFilter('all');
        setPresentationFilter('all');
        setStockFilter('all');
    };

    const getStockDisplay = (product: ProductWithStock) => {
        let displayStock = 0;
        let displayInTransit = 0;
        let stockStatus: StockStatus = 'ok';

        if (selectedStore === 'all') {
            displayStock = product.stockByStore.reduce((sum, s) => sum + s.stock, 0);
            displayInTransit = product.stockByStore.reduce((sum, s) => sum + s.inTransit, 0);
        } else {
            const storeStock = getProductStockForStore(product, selectedStore);
            if (storeStock) {
                displayStock = storeStock.stock;
                displayInTransit = storeStock.inTransit;
                stockStatus = getStockStatus(storeStock.stock, storeStock.minStock, storeStock.maxStock);
            }
        }

        return { displayStock, displayInTransit, stockStatus };
    };

    return (
        <div className="flex gap-6 h-[calc(100vh-140px)]">
            {/* Sidebar Filters */}
            <InventoryFilters
                familyFilter={familyFilter}
                presentationFilter={presentationFilter}
                stockFilter={stockFilter}
                showStockFilter={selectedStore !== 'all'}
                onFamilyChange={setFamilyFilter}
                onPresentationChange={setPresentationFilter}
                onStockChange={setStockFilter}
                onClear={clearFilters}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Bar */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-center gap-4">
                    {/* Store Selector */}
                    <div className="relative" ref={storeDropdownRef}>
                        <button
                            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:border-slate-400 min-w-[240px] justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <Store size={18} className="text-slate-500" />
                                <span className="font-medium text-slate-800">
                                    {selectedStore === 'all'
                                        ? 'Todas las Tiendas'
                                        : STORES_DATA.find(s => s.id === selectedStore)?.name
                                    }
                                </span>
                            </div>
                            <ChevronDown size={16} className="text-slate-400" />
                        </button>

                        {showStoreDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                <div className="p-2 border-b border-slate-100">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar tienda..."
                                            value={storeSearch}
                                            onChange={(e) => setStoreSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    <button
                                        onClick={() => {
                                            setSelectedStore('all');
                                            setShowStoreDropdown(false);
                                            setStoreSearch('');
                                            setStockFilter('all');
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${selectedStore === 'all' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        <MapPin size={16} className="text-slate-400" />
                                        <span className="font-medium">🌐 Todas las Tiendas</span>
                                    </button>
                                    <div className="border-t border-slate-100"></div>
                                    {filteredStoresForDropdown.map((store) => (
                                        <button
                                            key={store.id}
                                            onClick={() => {
                                                setSelectedStore(store.id);
                                                setShowStoreDropdown(false);
                                                setStoreSearch('');
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${selectedStore === store.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${store.status === 'online' ? 'bg-emerald-500' :
                                                        store.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                                                    }`}></span>
                                                <span>{store.name}</span>
                                            </div>
                                            <span className="text-xs text-slate-400">{store.city}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por SKU, nombre o color..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Export Button */}
                    <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                        <Download size={18} /> Exportar
                    </button>
                </div>

                {/* Products Table */}
                <div className="bg-white rounded-xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-left border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 font-medium w-28">SKU</th>
                                <th className="px-4 py-3 font-medium">Producto</th>
                                <th className="px-4 py-3 font-medium w-32">Familia</th>
                                <th className="px-4 py-3 font-medium w-20 text-center">Present.</th>
                                <th className="px-4 py-3 font-medium w-24 text-right">Precio</th>
                                <th className="px-4 py-3 font-medium w-28 text-center">
                                    {selectedStore === 'all' ? 'Stock Total' : 'Existencia'}
                                </th>
                                <th className="px-4 py-3 font-medium w-24 text-center">En Tránsito</th>
                                <th className="px-4 py-3 font-medium w-20 text-center">Acciones</th>
                            </tr>
                        </thead>
                    </table>

                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-100">
                                {filteredProducts.map((product) => {
                                    const { displayStock, displayInTransit, stockStatus } = getStockDisplay(product);

                                    return (
                                        <tr key={product.sku} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 w-28">
                                                <span className="font-mono text-slate-600 text-xs">{product.sku}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <span className="font-medium text-slate-800">{product.name}</span>
                                                    {product.color !== '—' && (
                                                        <span className="text-slate-500 ml-2">• {product.color}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 w-32">
                                                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                                                    {product.family}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 w-20 text-center text-slate-600">{product.presentation}</td>
                                            <td className="px-4 py-3 w-24 text-right font-medium text-slate-800">
                                                ${product.price.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 w-28 text-center relative">
                                                <button
                                                    onClick={() => setSelectedProduct(selectedProduct === product.sku ? null : product.sku)}
                                                    className={`font-bold px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${selectedStore === 'all'
                                                            ? 'text-slate-800 bg-slate-100'
                                                            : stockStatus === 'critical' ? 'text-red-700 bg-red-100'
                                                                : stockStatus === 'low' ? 'text-amber-700 bg-amber-100'
                                                                    : stockStatus === 'overstock' ? 'text-blue-700 bg-blue-100'
                                                                        : 'text-emerald-700 bg-emerald-100'
                                                        }`}
                                                >
                                                    {displayStock}
                                                </button>
                                                {selectedProduct === product.sku && (
                                                    <StockPopover product={product} onClose={() => setSelectedProduct(null)} />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 w-24 text-center">
                                                {displayInTransit > 0 ? (
                                                    <span className="text-blue-600 flex items-center justify-center gap-1 text-sm">
                                                        <Truck size={14} /> {displayInTransit}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 w-20 text-center">
                                                <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Ver detalles">
                                                    <Eye size={16} style={{ color: '#06aef0' }} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500 flex justify-between items-center">
                        <span>Mostrando {filteredProducts.length} de {PRODUCTS_CATALOG.length} productos</span>
                        {selectedStore !== 'all' && (
                            <span className="text-xs">
                                Tienda: <strong>{STORES_DATA.find(s => s.id === selectedStore)?.name}</strong>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryView;
