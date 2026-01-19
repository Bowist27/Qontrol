/**
 * StoreStatusCards Component
 * Traffic light cards showing Online/Warning/Offline stores count
 */

import { Wifi, AlertTriangle, WifiOff } from 'lucide-react';
import { STORES_DATA } from '../../data/mockData';

const StoreStatusCards: React.FC = () => {
    const onlineStores = STORES_DATA.filter(s => s.status === 'online').length;
    const warningStores = STORES_DATA.filter(s => s.status === 'warning').length;
    const offlineStores = STORES_DATA.filter(s => s.status === 'offline').length;

    const cards = [
        { label: 'Tiendas Online', count: onlineStores, icon: Wifi, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        { label: 'Con Alertas', count: warningStores, icon: AlertTriangle, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
        { label: 'Offline', count: offlineStores, icon: WifiOff, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
    ];

    return (
        <div className="grid grid-cols-3 gap-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div key={card.label} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${card.bgColor}`}>
                            <Icon size={24} className={card.iconColor} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">{card.count}</p>
                            <p className="text-sm text-slate-500">{card.label}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default StoreStatusCards;
