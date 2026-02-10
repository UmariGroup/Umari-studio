'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiMessageSquare, FiSend } from 'react-icons/fi';
import { clsx } from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Salom! Men Umari AI yordamchisiman. Marketplace, video, matn yaratish va marketing bo\'yicha savollaringizga javob beraman.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/vertex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages.map((item) => ({ role: item.role, content: item.content })),
        }),
      });

      if (!response.ok) throw new Error('Suhbat xatosi');

      const reader = response.body?.getReader();
      let assistantContent = '';

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          assistantContent += new TextDecoder().decode(value);

          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1].content = assistantContent;
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Uzr, xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const quickQuestions = [
    'Marketplace uchun rasm prompti yozib bering',
    'Video uchun qisqa ssenariy tuzing',
    'SEO uchun mahsulot tavsifi bering',
    'Sotuvni oshirish bo\'yicha g\'oya bering',
    'SMM kontent rejasi tuzing',
    'Brend uslubini yaxshilash yo\'llari',
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 shrink-0 rounded-3xl bg-gradient-to-r from-sky-500 to-blue-600 p-6 text-white shadow-xl shadow-blue-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="rounded-xl bg-white/20 p-2 text-white transition hover:bg-white/30">
                <FiArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
                  <FiMessageSquare className="h-6 w-6" /> AI suhbat
                </h1>
                <p className="text-sm text-white/80">24/7 aqlli yordamchi</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={clsx(
                    'max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm lg:max-w-[70%]',
                    message.role === 'user'
                      ? 'rounded-tr-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                      : 'rounded-tl-sm border border-slate-200 bg-slate-100 text-slate-800',
                  )}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div
                    className={clsx(
                      'mt-2 text-right text-[10px] font-medium opacity-70',
                      message.role === 'user' ? 'text-blue-100' : 'text-slate-500',
                    )}
                  >
                    {message.timestamp.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0s' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0.15s' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-4">
            {messages.length <= 1 ? (
              <div className="mb-4 overflow-x-auto pb-2">
                <div className="flex w-max gap-2">
                  {quickQuestions.map((question) => (
                    <button
                      key={question}
                      onClick={() => setInput(question)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-blue-400 hover:text-blue-600"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Savolingizni yozing..."
                className="h-[60px] max-h-[120px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white p-4 pr-12 text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || loading}
                className="absolute bottom-2 right-2 flex aspect-square items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSend className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">
              AI xato qilishi mumkin. Muhim ma'lumotlarni tekshirib oling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
