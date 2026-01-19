/**
 * SystemStatusModal Component
 * Shows the status of all system services
 */

import { Activity, X } from 'lucide-react';
import { SYSTEM_SERVICES } from '../../data/mockData';

interface SystemStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: '#06aef0' }}>
                            <Activity size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Estado del Sistema</h2>
                            <p className="text-sm text-slate-500">Servicios activos de Qontrol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Services List */}
                <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
                    {SYSTEM_SERVICES.map((service) => {
                        const IconComponent = service.icon;
                        return (
                            <div key={service.id} className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                                <div className="p-2.5 rounded-xl bg-slate-200">
                                    <IconComponent size={20} style={{ color: '#06aef0' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800">{service.name}</p>
                                    <p className="text-sm text-slate-500 truncate">{service.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {service.status === 'online' ? (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium text-white" style={{ backgroundColor: '#06aef0' }}>
                                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                                            Activo
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 text-white text-xs rounded-full font-medium">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                            Inactivo
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SystemStatusModal;
