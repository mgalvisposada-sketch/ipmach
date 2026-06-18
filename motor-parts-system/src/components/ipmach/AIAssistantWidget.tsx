'use client';

import { useState, useEffect } from 'react';

const MAX_HISTORY_MESSAGES = 20;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function formatClarifyingMessage(questions: string[]): string {
  if (questions.length === 0) return '';
  const intro = 'Para darte una respuesta precisa, necesito aclarar:';
  const numbered = questions.map((q, i) => `${i + 1}. ${q.startsWith('¿') ? q : `¿${q}${q.endsWith('?') ? '' : '?'}`}`).join('\n');
  return `${intro}\n\n${numbered}`;
}

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy el asistente de IPMach.\n\n' +
        'Sobre una referencia concreta: Pregunta por un part number que ya tengas (ej. "¿Para qué máquinas sirve 5S6684?" o "¿Qué es la referencia 9X1439?"). Te ayudo con la información de nuestro catálogo.\n\n' +
        'Información administrativa: Horarios, envíos, políticas, contacto — pregúntame y busco en la información disponible.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const openWidget = () => setIsOpen(true);
    window.addEventListener('openAIWidget', openWidget);
    return () => window.removeEventListener('openAIWidget', openWidget);
  }, []);

  const handleSend = async () => {
    const userMsg = input.trim();
    if (!userMsg) return;

    const userMessage: Message = {
      role: 'user',
      content: userMsg,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content })).slice(-MAX_HISTORY_MESSAGES);

    try {
      const res = await fetch('/api/ipmach/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, conversationHistory }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorContent = data.error || 'Error al procesar la solicitud.';
        setMessages((prev) => [...prev, { role: 'assistant', content: errorContent, timestamp: new Date() }]);
        return;
      }

      if (Array.isArray(data.clarifyingQuestions) && data.clarifyingQuestions.length > 0) {
        const content = formatClarifyingMessage(data.clarifyingQuestions);
        setMessages((prev) => [...prev, { role: 'assistant', content, timestamp: new Date() }]);
      } else {
        const answer =
          data.answer ||
          'No pude obtener una respuesta. Asegúrate de haber ejecutado "npm run catalog:extract" y de tener OPENAI_API_KEY configurada.';
        setMessages((prev) => [...prev, { role: 'assistant', content: answer, timestamp: new Date() }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.', timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-ipmach-yellow to-ipmach-yellow-light shadow-2xl hover:scale-110 transition-transform z-50 flex items-center justify-center group"
        >
          <div className="relative">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {/* Pulse animation */}
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </div>
        </button>
      )}

      {/* Chat widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden border border-slate-200 animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-ipmach-yellow to-ipmach-yellow-light p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg">Asistente IPMach</h3>
                  <p className="text-sm text-white/90 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    En línea
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-ipmach-yellow to-ipmach-yellow-light text-white'
                      : 'bg-white border border-slate-200 text-ipmach-dark'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-ipmach-gray-light rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-ipmach-gray-light rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-ipmach-gray-light rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ej: ¿Para qué sirve 5S6684? o ¿Horario de atención?"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-ipmach-yellow focus:ring-2 focus:ring-ipmach-yellow/20 outline-none text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-ipmach-yellow to-ipmach-yellow-light text-white font-medium hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
