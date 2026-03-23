import React, { useState } from 'react';
import { Search, Filter, Download, FileText, CheckCircle2, Clock, MoreVertical, Building } from 'lucide-react';

interface Invoice {
  id: string;
  folio: string;
  date: string;
  client: string;
  rfc: string;
  amount: number;
  status: 'certified' | 'pending' | 'cancelled';
}

const MOCK_INVOICES: Invoice[] = [
  { id: '1', folio: 'VTA-849302', date: '2026-03-20T10:30:00Z', client: 'Constructora Alfa', rfc: 'CALF010101XYZ', amount: 14500.50, status: 'certified' },
  { id: '2', folio: 'VTA-849303', date: '2026-03-20T09:15:00Z', client: 'Público General', rfc: 'XAXX010101000', amount: 2450.00, status: 'certified' },
  { id: '3', folio: 'VTA-849304', date: '2026-03-19T16:45:00Z', client: 'Desarrollos Inmobiliarios del Norte', rfc: 'DIN123456789', amount: 84000.00, status: 'pending' },
  { id: '4', folio: 'VTA-849280', date: '2026-03-18T11:20:00Z', client: ' Juan Pérez García', rfc: 'PEGJ800101ABC', amount: 650.00, status: 'certified' },
  { id: '5', folio: 'VTA-849210', date: '2026-03-15T14:10:00Z', client: 'Servicios de Mantenimiento', rfc: 'SMA991212QWE', amount: 5320.80, status: 'cancelled' },
];

const BillingAdminView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const StatusBadge = ({ status }: { status: Invoice['status'] }) => {
    switch (status) {
      case 'certified':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={12} /> Certificada</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> Procesando</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Cancelada</span>;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Facturación CFDI</h1>
          <p className="text-sm text-slate-500 mt-1">Monitorea y administra las facturas solicitadas por los clientes.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={16} />
            Exportar Reporte
          </button>
        </div>
      </div>

      {/* Analytics Mini-cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Facturado este mes</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={18} /></div>
          </div>
          <p className="text-2xl font-bold text-slate-900">$107,421.30</p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-emerald-600 font-medium">+12%</span>
            <span className="text-slate-400">vs mes anterior</span>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">CFDIs Emitidos</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={18} /></div>
          </div>
          <p className="text-2xl font-bold text-slate-900">42</p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-slate-500">Documentos timbrados correctamente</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Tickets sin factura</h3>
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><Building size={18} /></div>
          </div>
          <p className="text-2xl font-bold text-slate-900">18</p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-slate-500">Potenciales requerimientos fin de mes</span>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar folio, RFC o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors w-full sm:w-auto justify-center bg-white">
            <Filter size={16} /> Filtros
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Folio Venta</th>
                <th className="px-6 py-4 font-medium">Cliente/RFC</th>
                <th className="px-6 py-4 font-medium">Fecha Emisión</th>
                <th className="px-6 py-4 font-medium text-right">Importe Total</th>
                <th className="px-6 py-4 font-medium">Estado SAT</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_INVOICES.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded">{invoice.folio}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{invoice.client}</div>
                    <div className="text-xs font-mono text-slate-500 mt-0.5">{invoice.rfc}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">
                      {new Date(invoice.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(invoice.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-slate-900">
                      ${invoice.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Descargar PDF">
                        <FileText size={16} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded" title="Opciones">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50">
          <span>Mostrando 1 a 5 de 42 facturas</span>
          <div className="flex gap-1 border border-slate-300 rounded-lg overflow-hidden bg-white">
            <button className="px-3 py-1 hover:bg-slate-100 disabled:opacity-50">Anterior</button>
            <div className="w-[1px] bg-slate-300"></div>
            <button className="px-3 py-1 hover:bg-slate-100 disabled:opacity-50 text-blue-600 font-medium">1</button>
            <div className="w-[1px] bg-slate-300"></div>
            <button className="px-3 py-1 text-slate-400 disabled:opacity-50">2</button>
            <div className="w-[1px] bg-slate-300"></div>
            <button className="px-3 py-1 hover:bg-slate-100 disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingAdminView;
