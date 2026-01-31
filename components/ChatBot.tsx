
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/gemini';
import { ChatMessage } from '../types';

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Assalomu alaykum! Men professional marketplace-copywriter va SEO mutaxassisiman. Mahsulotingiz rasmlarini yuboring va men sizga Uzum, Wildberries yoki Ozon uchun ideal tavsif tayyorlab beraman.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // Explicitly cast to File[] to avoid unknown type inference issues that lead to 'Blob' assignment errors
      const fileList = Array.from(files).slice(0, 3) as File[];
      fileList.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImages(prev => [...prev, reader.result as string].slice(0, 3));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedImages.length === 0) || loading) return;

    const currentImages = [...selectedImages];
    const userMsg: ChatMessage = { 
      role: 'user', 
      text: input || (currentImages.length > 0 ? "Ushbu mahsulotlar uchun tavsif tayyorlang." : ""),
      image: currentImages.length > 0 ? currentImages[0] : undefined // UI display (first image)
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImages([]);
    setLoading(true);

    try {
      const response = await GeminiService.chat(userMsg.text, currentImages);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Xatolik yuz berdi. Qaytadan urinib ko'ring." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[85vh] flex flex-col bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-slideUp">
      <div className="bg-[#0055b8] p-6 text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </div>
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Marketplace Copywriter</h2>
            <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
               AI SEO Mutaxassisi
            </p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-3xl text-sm font-medium leading-relaxed shadow-sm transition-all duration-300 ${
              m.role === 'user' 
                ? 'bg-[#0055b8] text-white rounded-tr-none' 
                : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none whitespace-pre-wrap'
            }`}>
              {m.image && (
                <img src={m.image} className="w-48 h-48 object-cover rounded-xl mb-3 shadow-md border-2 border-white/20" alt="Uploaded" />
              )}
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 rounded-tl-none flex gap-2 items-center">
              <span className="w-2 h-2 bg-[#0055b8] rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-[#ef4444] rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-[#0055b8] rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
      </div>

      {selectedImages.length > 0 && (
        <div className="px-6 py-4 bg-white border-t border-slate-50 flex gap-4">
          {selectedImages.map((img, idx) => (
            <div key={idx} className="relative w-20 h-20 group">
              <img src={img} className="w-full h-full object-cover rounded-xl border-2 border-[#0055b8]/20 shadow-sm" alt="Preview" />
              <button 
                onClick={() => removeImage(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-6 bg-white border-t border-slate-100 flex gap-3 items-end">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-all border border-slate-200 shrink-0"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        </button>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
        
        <div className="flex-1 relative">
          <textarea 
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Mahsulot haqida yozing yoki rasm yuboring..."
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-50 focus:border-[#0055b8] outline-none transition-all resize-none max-h-32"
          />
        </div>
        
        <button 
          onClick={handleSend}
          disabled={loading}
          className="w-14 h-14 bg-[#0055b8] text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 transition-all shadow-xl active:scale-95 disabled:opacity-50 shrink-0"
        >
          <svg className="w-6 h-6 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
