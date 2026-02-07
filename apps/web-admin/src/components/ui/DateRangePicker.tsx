/**
 * DateRangePicker - Compact date range selector
 * Displays as single input "dd/mm/yyyy - dd/mm/yyyy"
 * Opens dropdown with dual date inputs when clicked
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangePickerProps {
    fromDate: string; // Internal format: YYYY-MM-DD
    toDate: string;   // Internal format: YYYY-MM-DD
    onFromDateChange: (date: string) => void;
    onToDateChange: (date: string) => void;
    onClear?: () => void;
}

// Convert YYYY-MM-DD to DD/MM/YYYY for display
const formatForDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
    onClear
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayValue = fromDate && toDate
        ? `${formatForDisplay(fromDate)} - ${formatForDisplay(toDate)}`
        : fromDate
            ? `${formatForDisplay(fromDate)} - ...`
            : toDate
                ? `... - ${formatForDisplay(toDate)}`
                : 'Seleccionar fechas';

    const hasValue = fromDate || toDate;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Compact display button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs transition-colors
                    ${isOpen
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : hasValue
                            ? 'border-blue-300 bg-white text-slate-700 hover:border-blue-400'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
            >
                <Calendar size={14} className={hasValue ? 'text-blue-500' : 'text-slate-400'} />
                <span className="whitespace-nowrap">{displayValue}</span>
                {hasValue && onClear && (
                    <X
                        size={14}
                        className="text-slate-400 hover:text-slate-600 ml-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                            setIsOpen(false);
                        }}
                    />
                )}
            </button>

            {/* Dropdown with date inputs */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 w-72">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Rango de Fechas</h4>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Desde</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => onFromDateChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => onToDateChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        {onClear && (
                            <button
                                onClick={() => {
                                    onClear();
                                    setIsOpen(false);
                                }}
                                className="flex-1 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
                            >
                                Limpiar
                            </button>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
