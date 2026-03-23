import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms: React.FC = () => {
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
        
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 mb-12">Términos y Condiciones</h1>
        
        <div className="space-y-8 text-zinc-600 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-medium text-zinc-900 mb-4 tracking-tight">1. Aceptación de los Términos</h2>
            <p>Al acceder y utilizar el portal de facturación de Qontroll y los servicios de Comex asociados, usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte, no podrá utilizar nuestros servicios.</p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-zinc-900 mb-4 tracking-tight">2. Uso del Servicio de Facturación</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>El servicio de facturación está disponible únicamente para compras realizadas en tiendas autorizadas.</li>
              <li>El usuario es responsable de ingresar datos fiscales correctos y veraces.</li>
              <li>Las facturas deben generarse dentro del mismo mes de la compra, según las disposiciones fiscales vigentes.</li>
              <li>Una vez emitida la factura (CFDI), no se permiten modificaciones ni refacturaciones a través de este portal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-medium text-zinc-900 mb-4 tracking-tight">3. Disponibilidad del Sistema</h2>
            <p>Qontroll se esfuerza por mantener el portal activo 24/7, sin embargo, no nos hacemos responsables por caídas del sistema de terceros (como el SAT o proveedores de timbrado PAC).</p>
          </section>
        </div>
      </main>

      <footer className="w-full pb-8 pt-4 px-6 relative z-10 text-center text-xs text-zinc-400 font-mono">
        <span>© {new Date().getFullYear()} Qontroll</span>
      </footer>
    </div>
  );
};

export default Terms;
