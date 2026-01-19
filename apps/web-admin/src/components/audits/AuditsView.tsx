/**
 * AuditsView Component
 * Main view for audits with tabs and step navigation
 */

import { useState } from 'react';
import { Upload, History } from 'lucide-react';
import AuditUploader from './AuditUploader';
import AuditDiffPreview from './AuditDiffPreview';
import AuditHistory from './AuditHistory';

type AuditStep = 'select' | 'preview' | 'history';

const AuditsView: React.FC = () => {
    const [step, setStep] = useState<AuditStep>('select');
    const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
    const [fileName, setFileName] = useState('');

    const handleContinueToPreview = (storeId: number, file: string) => {
        setSelectedStoreId(storeId);
        setFileName(file);
        setStep('preview');
    };

    const handleBack = () => {
        setStep('select');
    };

    const handleApply = () => {
        // In real app, would call API here
        alert('Cambios aplicados exitosamente');
        setStep('history');
    };

    const handleCancel = () => {
        setStep('select');
        setSelectedStoreId(null);
        setFileName('');
    };

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setStep('select')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${step === 'select' || step === 'preview'
                            ? 'text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    style={step === 'select' || step === 'preview' ? { backgroundColor: '#06aef0' } : {}}
                >
                    <Upload size={16} className="inline mr-2" />
                    Nueva Auditoría
                </button>
                <button
                    onClick={() => setStep('history')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${step === 'history'
                            ? 'text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    style={step === 'history' ? { backgroundColor: '#06aef0' } : {}}
                >
                    <History size={16} className="inline mr-2" />
                    Bitácora de Cargas
                </button>
            </div>

            {/* Content */}
            {step === 'select' && (
                <AuditUploader onContinue={handleContinueToPreview} />
            )}

            {step === 'preview' && selectedStoreId && (
                <AuditDiffPreview
                    storeId={selectedStoreId}
                    fileName={fileName}
                    onBack={handleBack}
                    onApply={handleApply}
                    onCancel={handleCancel}
                />
            )}

            {step === 'history' && <AuditHistory />}
        </div>
    );
};

export default AuditsView;
