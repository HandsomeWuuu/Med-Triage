'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Message, AnalysisResult } from '@/types';
import SankeyChart from '@/components/SankeyChart';
import DiagnosisPanel from '@/components/DiagnosisPanel';
import { 
  ChartBarIcon, 
  ArrowPathIcon, 
  PaperAirplaneIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  // State
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(0); // 追踪问题数量
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false); // 防止重复自动分析
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize messages after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setMessages([
      {
        id: '1',
        role: 'model',
        text: "您好，我是您的智能分诊助手。请简要描述您最主要的不舒服症状（例如：头痛、腹痛、发烧等）。",
        timestamp: new Date(),
        options: [],
        allowMultiple: false
      }
    ]);
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleReset = () => {
    if (messages.length > 1 && !window.confirm("确定要清除当前对话并重新开始吗？")) {
      return;
    }
    
    setMessages([
      {
        id: '1',
        role: 'model',
        text: "您好，我是您的智能分诊助手。请简要描述您最主要的不舒服症状（例如：头痛、腹痛、发烧等）。",
        timestamp: new Date(),
        options: [],
        allowMultiple: false
      }
    ]);
    setInput('');
    setIsTyping(false);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setSelectedOptions(new Set());
    setQuestionCount(0);
    setHasAutoAnalyzed(false);
  };

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input.trim();
    if (!textToSend || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedOptions(new Set());
    setIsTyping(true);

    try {
      // 调用后端 API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: messages,
          message: userMsg.text
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.text,
        options: data.options,
        allowMultiple: data.allowMultiple,
        timestamp: new Date()
      };

      setMessages(prev => {
        if (prev.length === 1 && prev[0].id === '1' && prev[0].text.includes("您好")) {
          return [...prev, botMsg]; 
        }
        return [...prev, botMsg];
      });
      
      // 增加问题计数（每次AI回复一个问题）
      setQuestionCount(prev => prev + 1);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "抱歉，系统遇到错误，请稍后重试。",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAnalyze = async () => {
    if (messages.length < 2) return;
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze');
      }

      const result = await response.json();
      setAnalysisResult(result);
    } catch (error) {
      console.error('Error analyzing:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 自动触发分析：当问题数量足够时
  useEffect(() => {
    // 当问题数达到4个且尚未自动分析时，触发分析
    if (questionCount >= 4 && !hasAutoAnalyzed && !isAnalyzing && messages.length >= 2) {
      console.log('🔄 Auto-triggering analysis after', questionCount, 'questions');
      setHasAutoAnalyzed(true);
      handleAnalyze();
    }
  }, [questionCount, hasAutoAnalyzed, isAnalyzing, messages.length]);

  // 下载问诊记录为 JSON 文件
  const handleDownloadRecord = () => {
    if (messages.length < 2) {
      alert('对话内容太少，无法保存');
      return;
    }
    
    const record = {
      id: `triage-${Date.now()}`,
      createdAt: new Date().toISOString(),
      messages: messages,
      analysisResult: analysisResult,
      summary: generateSummary()
    };
    
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `问诊记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 生成摘要
  const generateSummary = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    const chiefComplaint = userMessages[0]?.text || '未知';
    let mainDiagnosis = '待分析';
    
    if (analysisResult?.diagnoses && analysisResult.diagnoses.length > 0) {
      const top = analysisResult.diagnoses[0];
      mainDiagnosis = `${top.name} (${top.probability}%)`;
    }
    
    return `主诉: ${chiefComplaint.substring(0, 50)} | 诊断: ${mainDiagnosis}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleOption = (option: string, allowMultiple: boolean) => {
    if (allowMultiple) {
      const newSet = new Set(selectedOptions);
      if (newSet.has(option)) {
        newSet.delete(option);
      } else {
        newSet.add(option);
      }
      setSelectedOptions(newSet);
    } else {
      handleSendMessage(option);
    }
  };

  const submitMultiSelection = () => {
    if (selectedOptions.size === 0) return;
    const combinedText = Array.from(selectedOptions).join(', ');
    handleSendMessage(combinedText);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex h-screen bg-slate-100 font-sans items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-sm mt-3">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      
      {/* Sidebar / Left Panel - Chat */}
      <div className="w-full md:w-1/3 flex flex-col border-r border-slate-200 bg-white shadow-lg z-10">
        <header className="p-4 border-b border-blue-500 flex items-center justify-between bg-blue-600 text-white shadow-sm">
          <div className="flex items-center space-x-2">
            <ShieldCheckIcon className="w-6 h-6" />
            <h1 className="font-bold text-lg tracking-wide">AI 智能分诊</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadRecord}
              disabled={messages.length < 2}
              className="flex items-center space-x-1 px-2 py-1.5 bg-blue-700/50 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="下载问诊记录"
            >
              <DocumentArrowDownIcon className="w-3.5 h-3.5" />
              <span>下载记录</span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-700/50 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors border border-blue-400/30"
              title="清除当前会话"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>重新对话</span>
            </button>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-slate-50">
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            return (
              <div key={msg.id} className="flex flex-col">
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] rounded-2xl p-3 text-sm shadow-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>

                {isLastMessage && msg.role === 'model' && msg.options && msg.options.length > 0 && (
                  <div className="mt-3 ml-2 max-w-[90%]">
                     <p className="text-xs text-slate-400 mb-2 pl-1 font-medium uppercase tracking-wider">
                       {msg.allowMultiple ? '请选择所有符合的项：' : '请选择一项：'}
                     </p>
                     <div className="flex flex-wrap gap-2">
                       {msg.options.map((option, i) => {
                         const isSelected = selectedOptions.has(option);
                         return (
                           <button
                             key={i}
                             onClick={() => toggleOption(option, !!msg.allowMultiple)}
                             className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 text-left ${
                               isSelected
                                 ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-inner'
                                 : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-sm'
                             }`}
                           >
                             <div className="flex items-center space-x-2">
                               {msg.allowMultiple && (
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                     {isSelected && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                  </div>
                               )}
                               <span>{option}</span>
                             </div>
                           </button>
                         );
                       })}
                     </div>
                     
                     {msg.allowMultiple && selectedOptions.size > 0 && (
                       <div className="mt-3">
                         <button
                           onClick={submitMultiSelection}
                           className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center space-x-1"
                         >
                           <span>确认选择</span>
                           <PaperAirplaneIcon className="w-3 h-3" />
                         </button>
                       </div>
                     )}
                     
                     {/* 提示用户也可以打字描述 */}
                     <p className="text-[10px] text-slate-400 mt-3 pl-1 italic">
                       💡 也可以在下方输入框中打字描述您的具体情况
                     </p>
                  </div>
                )}
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 shadow-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="可选择上方选项，或在此输入详细描述..."
              className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 resize-none text-sm text-slate-800 placeholder-slate-400"
              rows={2}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            AI可能会犯错，仅供参考，不可替代专业医疗建议。
          </p>
        </div>
      </div>

      {/* Right Panel - Visualization & Diagnosis */}
      <div className="hidden md:flex flex-col w-2/3 bg-slate-50 h-full overflow-hidden">
        
        <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-slate-700">
            <ChartBarIcon className="w-5 h-5 text-blue-600" />
            <span className="font-semibold">临床分析面板</span>
            {questionCount > 0 && questionCount < 4 && !hasAutoAnalyzed && (
              <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                问诊进度: {questionCount}/4
              </span>
            )}
            {hasAutoAnalyzed && (
              <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                已完成初步分析
              </span>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || messages.length < 2}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              isAnalyzing 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg'
            }`}
          >
            <ArrowPathIcon className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? '分析中...' : '更新分析'}</span>
          </button>
        </header>

        {/* Content Grid */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            
            {/* Left Column of Dashboard: Differential Diagnosis List */}
            <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">鉴别诊断</h2>
                <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border">最匹配</span>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                 <DiagnosisPanel data={analysisResult} isLoading={isAnalyzing} />
              </div>
            </div>

            {/* Right Column of Dashboard: Sankey Chart */}
            <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">症状图谱</h2>
                <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-slate-500">症状</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        <span className="text-slate-500">疾病</span>
                    </div>
                </div>
              </div>
              <div className="flex-1 p-4">
                 <SankeyChart data={analysisResult} />
              </div>
            </div>

          </div>
        </div>

        {/* Footer Warning */}
        <div className="p-3 bg-amber-50 border-t border-amber-100 flex items-center justify-center space-x-2 text-amber-700 text-xs shrink-0">
          <ExclamationTriangleIcon className="w-4 h-4" />
          <span>本工具仅用于演示，紧急情况请立即拨打急救电话。</span>
        </div>
      </div>

    </div>
  );
};

export default App;
