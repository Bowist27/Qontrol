import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-600 font-sans selection:bg-[#00418f]/10 selection:text-[#00418f] relative overflow-hidden flex flex-col items-center">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 w-[800px] h-[400px] bg-[#00418f]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Navbar / Header */}
      <header className="w-full border-b border-black/[0.04] bg-white/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-sm bg-[#00418f] flex items-center justify-center">
              <span className="text-white font-bold text-xs">Q</span>
            </div>
            <span className="text-zinc-900 font-medium text-sm tracking-wide">Qontroll Legal</span>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="text-xs font-mono tracking-wider text-zinc-500 hover:text-[#00418f] transition-colors flex items-center gap-1"
          >
            <ChevronLeft size={14} /> Volver
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl px-6 py-20 flex-grow relative z-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-black/[0.05] bg-white mb-8 shadow-sm">
          <span className="text-[10px] uppercase tracking-widest font-medium text-zinc-500">Última actualización: Marzo 2026</span>
        </div>
        
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 mb-12">Aviso de Privacidad</h1>
        
        <div className="space-y-8 text-zinc-600 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-medium text-zinc-900 mb-4 tracking-tight">1. Recopilación de Información</h2>
            <p>Qontroll, como proveedor tecnológico, recaba datos personales y fiscales (RFC, Razón Social, Código Postal, Uso CFDI, Correo Electrónico) estrictamente necesarios para la emisión de Comprobantes Fiscales Digitales por Internet (CFDI).</p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-zinc-900 mb-4 tracking-tight">2. Uso de los Datos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Timbrado y emisión de facturas ante el SAT.</li>
              <li>Envío de archivos XML y PDF correspondientes al correo proporcionado.</li>
              <li>Los datos proporcionados serán utilizados exclusivamente para estos fines y no serán vendidos ni transferidos a terceros con fines de marketing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-medium text-zinc-900 mb-4 tracking-tight">3. Seguridad</h2>
            <p>Nos comprometemos a retener y procesar todos sus datos de manera segura y encriptada durante su tránsito, limitando el acceso solo a los sistemas necesarios para el correcto funcionamiento del portal de facturación.</p>
          </section>
        </div>
      </main>

      <footer className="w-full pb-8 pt-4 px-6 relative z-10 text-center text-xs text-zinc-400 font-mono">
        <span>© {new Date().getFullYear()} Qontroll</span>
      </footer>
    </div>
  );
};

export default Privacy;
