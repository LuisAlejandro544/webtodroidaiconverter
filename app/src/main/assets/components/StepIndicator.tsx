import React from 'react';
import { Step } from '../types';

interface StepIndicatorProps {
  currentStep: Step;
}

const steps = [
  { id: Step.UPLOAD, label: 'Código' },
  { id: Step.ANALYZE, label: 'IA Análisis' },
  { id: Step.ICON, label: 'Diseño' },
  { id: Step.BUILD, label: 'Construir' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="flex justify-between relative">
        {/* Progress Bar Background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -z-0 transform -translate-y-1/2 rounded"></div>
        
        {/* Active Progress Bar */}
        <div 
            className="absolute top-1/2 left-0 h-1 bg-blue-500 -z-0 transform -translate-y-1/2 rounded transition-all duration-500"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((s, idx) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center group">
            <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    currentStep >= s.id 
                    ? 'bg-slate-900 border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                    : 'bg-slate-800 border-slate-600 text-slate-500'
                }`}
            >
              {currentStep > s.id ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <span className="font-bold">{idx + 1}</span>
              )}
            </div>
            <span className={`mt-2 text-xs font-medium uppercase tracking-wider ${currentStep >= s.id ? 'text-blue-400' : 'text-slate-500'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};