import React, { useState } from 'react';

// Icons
const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
    </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
    </svg>
);

const PrinterIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
    </svg>
);

const MailIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

interface PosBillingViewProps {
    onBack: () => void;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({ onBack }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [ticketData, setTicketData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [invoiceSuccess, setInvoiceSuccess] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;
        
        setIsSearching(true);
        // Mock search delay
        setTimeout(() => {
            setTicketData({
                folio: searchQuery.toUpperCase(),
                date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                totalAmount: 4850.50,
                items: [
                    { id: '102', description: 'Vinimex Total Satin Blanc (19L)', quantity: 2, price: 1850.00 },
                    { id: '205', description: 'Brocha de Pelo de Camello 3"', quantity: 5, price: 85.00 },
                    { id: '89', description: 'Cinta Azul 3M', quantity: 3, price: 241.83 }
                ],
                alreadyInvoiced: searchQuery.includes('F'),
                clientSuggestion: {
                    rfc: 'XAXX010101000',
                    name: 'PÚBLICO EN GENERAL',
                    zip: '00000',
                    regime: '616' // Sin obligaciones
                }
            });
            setIsSearching(false);
        }, 600);
    };

    const handleGenerateInvoice = () => {
        setIsGenerating(true);
        setTimeout(() => {
            setIsGenerating(false);
            setInvoiceSuccess(true);
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 font-sans flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 h-16 flex items-center px-6 shrink-0 z-10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                    <span className="font-medium">Volver</span>
                </button>
                <div className="mx-auto flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Facturación en Mostrador</h1>
                </div>
                <div className="w-[85px]"></div> {/* Spacer for centering */}
            </header>

            <main className="flex-1 overflow-auto p-6 md:p-8">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Column: Search & Ticket Data */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Search Box */}
                        <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-xl shadow-black/20">
                            <h2 className="text-lg font-semibold text-white mb-4">Buscar Venta o Cliente</h2>
                            <form onSubmit={handleSearch} className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    {isSearching ? (
                                        <div className="w-4 h-4 border-2 border-slate-500 border-t-blue-500 rounded-full animate-spin" />
                                    ) : (
                                        <SearchIcon className="w-5 h-5 text-slate-500" />
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Folio de ticket, RFC, Correo o Nombre..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm uppercase font-mono"
                                    autoFocus
                                />
                                <button type="submit" className="hidden">Buscar</button>
                            </form>
                            <p className="text-xs text-slate-500 mt-3 flex gap-2"><span className="text-blue-400">Tip:</span> Escanea el ticket, o ingresa el correo del cliente para reimprimir su última factura.</p>
                        </div>

                        {/* Ticket Preview if Found */}
                        {ticketData && (
                            <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-xl shadow-black/20 flex flex-col h-[calc(100vh-340px)] min-h-[400px]">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Detalle del Ticket</h3>
                                        <p className="text-2xl font-mono text-white mt-1">{ticketData.folio}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 mb-1">Fecha de Compra</p>
                                        <p className="text-sm text-slate-300 font-medium">{ticketData.date}</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto -mx-2 px-2">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700 text-slate-500">
                                                <th className="font-medium pb-2 text-left">Cant</th>
                                                <th className="font-medium pb-2 text-left">Concepto</th>
                                                <th className="font-medium pb-2 text-right">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {ticketData.items.map((item: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="py-3 text-slate-300">{item.quantity}</td>
                                                    <td className="py-3 text-slate-300 truncate max-w-[150px]">{item.description}</td>
                                                    <td className="py-3 text-right text-slate-300">${item.price.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="pt-4 mt-auto border-t border-slate-700">
                                    <div className="flex justify-between items-center text-lg">
                                        <span className="font-medium text-slate-400">Total a Facturar</span>
                                        <span className="font-bold text-white text-2xl">${ticketData.totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Invoicing Actions */}
                    <div className="lg:col-span-7">
                        {ticketData ? (
                            ticketData.alreadyInvoiced ? (
                                <div className="bg-slate-800 rounded-2xl border border-emerald-500/30 p-8 shadow-xl shadow-emerald-900/10 flex flex-col items-center justify-center h-full text-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-10 -mt-20"></div>
                                    
                                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                                        <CheckIcon className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    
                                    <h2 className="text-2xl font-bold text-white mb-2">Ticket Ya Facturado</h2>
                                    <p className="text-slate-400 mb-8 max-w-sm">Este ticket fue facturado previamente. El folio fiscal es <span className="text-emerald-400 font-mono">UUID-A78B-93C0</span>.</p>
                                    
                                    <div className="flex gap-4 w-full max-w-sm">
                                        <button className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-xl font-medium transition-colors">
                                            <PrinterIcon className="w-5 h-5" />
                                            Reimprimir
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-xl font-medium transition-colors">
                                            <MailIcon className="w-5 h-5" />
                                            Reenviar
                                        </button>
                                    </div>
                                </div>
                            ) : invoiceSuccess ? (
                                <div className="bg-slate-800 rounded-2xl border border-emerald-500/30 p-8 shadow-xl shadow-emerald-900/10 flex flex-col items-center justify-center h-full text-center relative overflow-hidden">
                                     <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6">
                                        <CheckIcon className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">¡Factura Creada!</h2>
                                    <p className="text-slate-400 mb-8">El CFDI 4.0 fue timbrado y enviado con éxito.</p>
                                    
                                    <div className="flex flex-col gap-3 w-full max-w-sm">
                                        <button className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-xl font-medium transition-colors">
                                            <PrinterIcon className="w-5 h-5" />
                                            Imprimir Copia Física
                                        </button>
                                        <button 
                                            onClick={() => { setTicketData(null); setSearchQuery(''); setInvoiceSuccess(false); }}
                                            className="w-full py-3 text-slate-400 hover:text-white font-medium"
                                        >
                                            Facturar otro ticket
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-xl shadow-black/20 h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-xl font-bold text-white">Datos Fiscales del Cliente</h2>
                                        <span className="text-xs font-mono px-2 py-1 bg-blue-500/20 text-blue-400 rounded">CFDI 4.0</span>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">RFC</label>
                                            <input type="text" defaultValue={ticketData.clientSuggestion.rfc} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white font-mono uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Razón Social</label>
                                            <input type="text" defaultValue={ticketData.clientSuggestion.name} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">C.P. (Fiscal)</label>
                                                <input type="text" defaultValue={ticketData.clientSuggestion.zip} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Régimen Fiscal</label>
                                                <select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                                                    <option>616 - Sin obligaciones fiscales</option>
                                                    <option>601 - General de Ley Personas Morales</option>
                                                    <option>612 - Personas Físicas con Actividades Empresariales</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Uso de CFDI</label>
                                            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                                                <option>S01 - Sin efectos fiscales</option>
                                                <option>G03 - Gastos en general</option>
                                                <option>G01 - Adquisición de mercancías</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-10 pt-6 border-t border-slate-700">
                                        <button 
                                            onClick={handleGenerateInvoice}
                                            disabled={isGenerating}
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Conectando con SAT/PAC...
                                                </>
                                            ) : (
                                                <>
                                                    Generar y Timbrar Factura
                                                    <CheckIcon className="w-5 h-5" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed p-6 h-full flex flex-col items-center justify-center text-center">
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                    <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-medium text-slate-300 mb-2">Esperando selección</h3>
                                <p className="text-slate-500 max-w-sm">Busca o escanea un ticket en el panel izquierdo para comenzar su facturación o reimpresión.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
