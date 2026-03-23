import React from 'react';
import { CheckCircle2, Download, ArrowRight, FileText } from 'lucide-react';
import { useLocation, useNavigate, Navigate, Link } from 'react-router-dom';

interface LocationState {
  email: string;
  folio: string;
}

const InvoiceSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  // Protect route if no state
  if (!state?.email || !state?.folio) {
    return <Navigate to="/facturacion" replace />;
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-600 font-sans selection:bg-[#00418f]/10 selection:text-[#00418f] relative overflow-hidden flex flex-col items-center">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 w-[600px] h-[600px] bg-[#00418f]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />

      <main className="w-full max-w-2xl mx-auto px-6 py-20 lg:py-32 flex-grow relative z-10 flex flex-col items-center">
        
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-[#00418f]/10 border border-[#00418f]/20 flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 bg-[#00418f]/10 rounded-full blur-xl"></div>
          <CheckCircle2 size={32} className="text-[#00418f] relative z-10" />
        </div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900 mb-4 text-center">
          Factura generada.
        </h1>
        
        <p className="text-zinc-500 text-lg leading-relaxed text-center max-w-md mb-12">
          Hemos enviado los archivos XML y PDF a <strong className="text-zinc-900 font-medium">{state.email}</strong> correspondientes al ticket <strong className="text-zinc-900 font-medium">{state.folio}</strong>.
        </p>

        {/* Invoice details card */}
        <div className="w-full relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-black/[0.02] to-transparent rounded-2xl pointer-events-none" />
          
          <div className="relative bg-white border border-black/[0.05] shadow-sm rounded-2xl p-6 md:p-8">
            {/* Actions */}
            <div className="grid sm:grid-cols-2 gap-4">
              <button className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/80 transition-colors group/btn">
                <div className="flex items-center gap-3">
                  <div className="text-[#00418f] bg-[#00418f]/5 p-2 rounded-lg">
                    <Download size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-900 mb-0.5">Descargar XML</p>
                    <p className="text-[11px] text-zinc-500 font-mono">14 KB</p>
                  </div>
                </div>
              </button>
              
              <button className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/80 transition-colors group/btn">
                <div className="flex items-center gap-3">
                  <div className="text-[#00418f] bg-[#00418f]/5 p-2 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-900 mb-0.5">Descargar PDF</p>
                    <p className="text-[11px] text-zinc-500 font-mono">245 KB</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Action button to fast track to next ticket */}
        <div className="mt-12">
           <button
             onClick={() => navigate('/facturacion')}
             className="text-sm font-medium text-zinc-500 hover:text-[#00418f] flex items-center gap-2 transition-colors border-b border-transparent hover:border-[#00418f]/30 pb-0.5"
           >
             Facturar otro ticket
             <ArrowRight size={14} />
           </button>
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

export default InvoiceSuccess;
