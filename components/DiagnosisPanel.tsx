import React from 'react';
import { AnalysisResult, UrgencyLevel } from '../types';

interface DiagnosisPanelProps {
  data: AnalysisResult | null;
  isLoading: boolean;
}

const DiagnosisPanel: React.FC<DiagnosisPanelProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm animate-pulse">正在分析临床数据...</p>
      </div>
    );
  }

  if (!data || data.diagnoses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm px-6 text-center">
        <p>暂无诊断结果。请在左侧描述症状并点击“更新分析”。</p>
      </div>
    );
  }

  const getUrgencyColor = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case UrgencyLevel.Critical: return 'bg-red-100 text-red-800 border-red-200';
      case UrgencyLevel.High: return 'bg-orange-100 text-orange-800 border-orange-200';
      case UrgencyLevel.Medium: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case UrgencyLevel.Low: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getUrgencyLabel = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case UrgencyLevel.Critical: return '危重';
      case UrgencyLevel.High: return '紧急';
      case UrgencyLevel.Medium: return '关注';
      case UrgencyLevel.Low: return '普通';
      default: return urgency;
    }
  };

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-2">
      {data.diagnoses.map((dx, index) => (
        <div key={index} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-slate-800 text-lg">{dx.name}</h3>
            <span className={`px-2 py-1 rounded text-xs font-semibold border ${getUrgencyColor(dx.urgency)}`}>
              {getUrgencyLabel(dx.urgency)}
            </span>
          </div>
          
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>可能性</span>
              <span>{dx.probability}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${dx.probability}%` }}
              ></div>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            {dx.description}
          </p>

          <div className="bg-slate-50 p-2 rounded text-xs text-slate-700 border border-slate-100">
            <strong className="font-semibold text-slate-900">建议处置:</strong> {dx.recommendedAction}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiagnosisPanel;