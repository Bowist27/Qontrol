import React, { useState } from 'react';
import { Search, ChevronRight, Receipt, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const BillingPortal: React.FC = () => {
  const navigate = useNavigate();
  // Step 1 states
  const [ticketFolio, setTicketFolio] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2 states (Fiscal details)
  const [formData, setFormData] = useState({
    rfc: '',
    razonSocial: '',
    cp: '',
    email: '',
    usoCfdi: 'G03',
    regimenFiscal: '601', // General de Ley Personas Morales
  });

  // Mock ticket search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!ticketFolio.trim()) {
      setError('Por favor ingresa un número de ticket o folio');
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      // Mock validation
      if (ticketFolio.toUpperCase() === 'ERROR') {
        setError('No se encontró el ticket. Verifica el folio impreso en tu recibo.');
      } else {
        setStep(2);
      }
    }, 800);
  };

  const handleInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate Facturama API call
    setTimeout(() => {
      setLoading(false);
      navigate('/facturacion/exito', { state: { email: formData.email, folio: ticketFolio } });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-600 font-sans selection:bg-[#00418f]/10 selection:text-[#00418f] relative overflow-hidden flex flex-col items-center">
      {/* Background ambient light - COMEX BLUE */}
      <div className="absolute top-0 left-1/2 w-[800px] h-[400px] bg-[#00418f]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <main className="w-full max-w-4xl px-6 py-20 lg:py-32 flex-grow relative z-10 flex flex-col md:flex-row gap-16 md:gap-24">
        
        {/* Left Column: Context / Intro */}
        <div className="flex-1 md:pr-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900 mb-6 leading-[1.1]">
            <span className="text-zinc-400">Autoservicio</span><br/>
            Facturación.
          </h1>
          
          <p className="text-zinc-500 text-lg leading-relaxed max-w-md mb-8">
            Genera y descarga tus Comprobantes Fiscales Digitales por Internet (CFDI) al instante a partir del folio en tu recibo de compra.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 min-w-[20px] text-zinc-400"><Receipt size={18} /></div>
              <p className="text-sm">Localiza el <strong className="text-zinc-900 font-medium tracking-tight">Folio de Facturación</strong> impreso en la parte inferior de tu recibo de compra.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 min-w-[20px] text-zinc-400"><AlertCircle size={18} /></div>
              <p className="text-sm">Tienes hasta el <strong className="text-zinc-900 font-medium tracking-tight">último día del mes</strong> para generar tu factura.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Card */}
        <div className="flex-1 max-w-md w-full relative">
          {/* subtle glow behind card border */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-black/[0.02] to-transparent rounded-2xl pointer-events-none" />
          
          <div className="relative bg-white rounded-2xl p-8 border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.01]">
            
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-zinc-400 uppercase tracking-[0.15em]">
                <span>Paso {step} de 2</span>
              </div>
              <h2 className="text-xl font-medium tracking-tight text-zinc-900">
                {step === 1 ? 'Busca tu ticket' : 'Datos Fiscales'}
              </h2>
            </div>

            {error && (
              <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-600 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-2.5">
                  <label htmlFor="folio" className="block text-sm font-medium text-zinc-700">
                    Folio de Ticket
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-[#00418f] transition-colors">
                      <Search size={16} />
                    </div>
                    <input
                      id="folio"
                      type="text"
                      value={ticketFolio}
                      onChange={(e) => setTicketFolio(e.target.value)}
                      placeholder="Ej. VTA-123456"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-10 pr-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00418f] focus:ring-1 focus:ring-[#00418f] transition-all font-mono text-sm"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !ticketFolio.trim()}
                  className="w-full bg-[#00418f] text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-[#003370] focus:outline-none focus:ring-2 focus:ring-[#00418f]/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <>
                      Continuar
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <form onSubmit={handleInvoice} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Simplified Ticket details overview */}
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-zinc-400 mb-0.5">Ticket</p>
                    <p className="text-sm font-mono text-zinc-900 font-medium">{ticketFolio}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-widest text-zinc-400 mb-0.5">Monto Total</p>
                    <p className="text-sm font-mono text-zinc-900 font-medium">$2,450.00</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium tracking-tight text-zinc-600 mb-1.5">RFC</label>
                    <input
                      required
                      type="text"
                      value={formData.rfc}
                      onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                      className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#00418f] focus:ring-1 focus:ring-[#00418f] uppercase font-mono placeholder:text-zinc-400"
                      placeholder="XAXX010101000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium tracking-tight text-zinc-600 mb-1.5">Razón Social</label>
                    <input
                      required
                      type="text"
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#00418f] focus:ring-1 focus:ring-[#00418f] placeholder:text-zinc-400"
                      placeholder="Nombre tal cual en Constancia"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium tracking-tight text-zinc-600 mb-1.5">Código Postal</label>
                      <input
                        required
                        type="text"
                        maxLength={5}
                        value={formData.cp}
                        onChange={(e) => setFormData({ ...formData, cp: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#00418f] focus:ring-1 focus:ring-[#00418f] font-mono placeholder:text-zinc-400"
                        placeholder="00000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium tracking-tight text-zinc-600 mb-1.5">Uso CFDI</label>
                      <select
                        value={formData.usoCfdi}
                        onChange={(e) => setFormData({ ...formData, usoCfdi: e.target.value })}
                        className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#00418f] focus:ring-1 focus:ring-[#00418f] appearance-none"
                      >
                        <option value="G01">G01 - Mercancías</option>
                        <option value="G03">G03 - Gastos gral.</option>
                        <option value="P01">P01 - Por definir</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium tracking-tight text-zinc-600 mb-1.5">Email recepción</label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#00418f] focus:ring-1 focus:ring-[#00418f] placeholder:text-zinc-400"
                      placeholder="correo@empresa.com"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#00418f] text-white font-medium py-2.5 px-6 rounded-md flex items-center justify-center gap-2 hover:bg-[#003370] focus:outline-none focus:ring-2 focus:ring-[#00418f]/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin text-white" /> : 'Emitir Factura'}
                  </button>
                </div>
              </form>
            )}

            {/* Helper footer inside card */}
          </div>
        </div>
      </main>
      
      {/* Footer minimal */}
      <footer className="w-full pb-8 pt-4 px-6 relative z-10 text-center text-xs text-zinc-400 font-mono flex items-center justify-center gap-4">
        <span>© {new Date().getFullYear()} Qontroll</span>
        <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
        <Link to="/terminos" target="_blank" className="hover:text-zinc-600 transition-colors border-b border-transparent hover:border-zinc-300">Términos</Link>
        <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
        <Link to="/privacidad" target="_blank" className="hover:text-zinc-600 transition-colors border-b border-transparent hover:border-zinc-300">Privacidad</Link>
      </footer>
    </div>
  );
};

export default BillingPortal;
