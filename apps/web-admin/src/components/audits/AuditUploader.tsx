/**
 * AuditUploader Component
 * Step 1: Select store and upload file
 */

import { useState, useRef, useEffect } from 'react';
import { Store, ChevronDown, Upload, FileSpreadsheet, X } from 'lucide-react';
import { STORES_DATA } from '../../data/mockData';

interface AuditUploaderProps {
    onContinue: (storeId: number, fileName: string) => void;
}

const AuditUploader: React.FC<AuditUploaderProps> = ({ onContinue }) => {
    const [selectedStore, setSelectedStore] = useState<number | null>(null);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [storeSearch, setStoreSearch] = useState('');
    const [fileUploaded, setFileUploaded] = useState(false);
    const [fileName, setFileName] = useState('');

    const storeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
                setShowStoreDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredStores = STORES_DATA.filter(s =>
        s.id !== 31 && // Exclude central warehouse
        (s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
            s.city.toLowerCase().includes(storeSearch.toLowerCase()))
    );

    const handleFileUpload = () => {
        setFileName('inventario_celaya_enero_2026.xlsx');
        setFileUploaded(true);
    };

    const handleContinue = () => {
        if (selectedStore && fileUploaded) {
            onContinue(selectedStore, fileName);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Cargar Inventario Físico</h3>
                <p className="text-slate-500 mb-8">
                    Selecciona la tienda y sube el archivo Excel con el conteo físico. El sistema comparará los datos antes de aplicar cambios.
                </p>

                {/* Step 1: Select Store */}
                <div className="mb-8">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        1. ¿De qué tienda son estos datos?
                    </label>
                    <div className="relative" ref={storeDropdownRef}>
                        <button
                            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                            className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg text-left transition-colors ${selectedStore ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Store size={20} className={selectedStore ? 'text-emerald-600' : 'text-slate-400'} />
                                <span className={selectedStore ? 'font-medium text-slate-800' : 'text-slate-500'}>
                                    {selectedStore
                                        ? STORES_DATA.find(s => s.id === selectedStore)?.name
                                        : 'Selecciona una tienda...'
                                    }
                                </span>
                            </div>
                            <ChevronDown size={18} className="text-slate-400" />
                        </button>

                        {showStoreDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                <div className="p-2 border-b border-slate-100">
                                    <input
                                        type="text"
                                        placeholder="Buscar tienda..."
                                        value={storeSearch}
                                        onChange={(e) => setStoreSearch(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {filteredStores.map((store) => (
                                        <button
                                            key={store.id}
                                            onClick={() => {
                                                setSelectedStore(store.id);
                                                setShowStoreDropdown(false);
                                                setStoreSearch('');
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-slate-50 ${selectedStore === store.id ? 'bg-blue-50' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${store.status === 'online' ? 'bg-emerald-500' :
                                                        store.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                                                    }`}></span>
                                                <span className="font-medium">{store.name}</span>
                                            </div>
                                            <span className="text-xs text-slate-400">{store.city}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 2: Upload File */}
                <div className="mb-8">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        2. Sube el archivo Excel
                    </label>
                    {!fileUploaded ? (
                        <div
                            onClick={selectedStore ? handleFileUpload : undefined}
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${selectedStore
                                    ? 'border-slate-300 hover:border-blue-400 cursor-pointer hover:bg-blue-50'
                                    : 'border-slate-200 bg-slate-50 cursor-not-allowed'
                                }`}
                        >
                            <Upload size={40} className={selectedStore ? 'mx-auto text-slate-400 mb-3' : 'mx-auto text-slate-300 mb-3'} />
                            <p className={selectedStore ? 'font-medium text-slate-700' : 'font-medium text-slate-400'}>
                                {selectedStore ? 'Clic para seleccionar archivo' : 'Primero selecciona una tienda'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Formatos: .xlsx, .xls, .csv</p>
                        </div>
                    ) : (
                        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet size={24} className="text-emerald-600" />
                                <div>
                                    <p className="font-medium text-slate-800">{fileName}</p>
                                    <p className="text-xs text-slate-500">Archivo listo para procesar</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setFileUploaded(false); setFileName(''); }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Continue Button */}
                <button
                    onClick={handleContinue}
                    disabled={!selectedStore || !fileUploaded}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${selectedStore && fileUploaded
                            ? 'text-white hover:opacity-90'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    style={selectedStore && fileUploaded ? { backgroundColor: '#06aef0' } : {}}
                >
                    Comparar y Previsualizar
                </button>
            </div>
        </div>
    );
};

export default AuditUploader;
