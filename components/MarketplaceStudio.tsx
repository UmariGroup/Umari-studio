
import React, { useState, useEffect } from 'react';
import { GeminiService } from '../services/gemini';

const MarketplaceStudio: React.FC = () => {
  const [productImages, setProductImages] = useState<(string | null)[]>([null]);
  const [styleImages, setStyleImages] = useState<(string | null)[]>([null]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [countdown, setCountdown] = useState(9);

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 1 ? prev - 1 : 1));
      }, 1000);
    } else {
      setCountdown(9);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const handleUpload = (
    index: number, 
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'product' | 'style'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const state = type === 'product' ? productImages : styleImages;
        const setState = type === 'product' ? setProductImages : setStyleImages;
        
        const newImages = [...state];
        newImages[index] = reader.result as string;
        
        if (newImages.length < 5 && newImages[index] !== null) {
          newImages.push(null);
        }
        setState(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number, type: 'product' | 'style') => {
    const state = type === 'product' ? productImages : styleImages;
    const setState = type === 'product' ? setProductImages : setStyleImages;
    
    let newImages = state.filter((_, i) => i !== index);
    if (newImages.length === 0 || newImages[newImages.length - 1] !== null) {
      newImages.push(null);
    }
    setState(newImages);
  };

  const handleMagicWand = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const enhanced = await GeminiService.enhancePrompt(prompt);
      setPrompt(enhanced);
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    const activeProducts = productImages.filter(img => img !== null) as string[];
    if (activeProducts.length === 0) {
      alert("Iltimos, kamida bitta mahsulot rasmini yuklang.");
      return;
    }

    setLoading(true);
    setGeneratedImage(null);
    try {
      const result = await GeminiService.generateMarketplaceImage(
        prompt, 
        activeProducts, 
        styleImages.filter(img => img !== null) as string[],
        aspectRatio
      );
      setGeneratedImage(result);
    } catch (error) {
      alert("Xatolik: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-[#0055b8] rounded-[1.5rem] shadow-xl">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Market Studio</h2>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase mt-1">Free AI Image Production</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-green-50 px-8 py-4 rounded-3xl border border-green-100">
          <span className="text-xs font-black text-green-600 uppercase tracking-widest italic animate-pulse">Bepul Rejim Faol</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Mahsulot Rasmlari</h3>
              <div className="flex flex-wrap gap-3">
                {productImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 transition-all hover:border-[#0055b8] group">
                    {img ? (
                      <>
                        <img src={img} className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(idx, 'product')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <input type="file" onChange={(e) => handleUpload(idx, e, 'product')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Uslub Rasmlari (Referens)</h3>
              <div className="flex flex-wrap gap-3">
                {styleImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 transition-all hover:border-[#0055b8] group">
                    {img ? (
                      <>
                        <img src={img} className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(idx, 'style')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <input type="file" onChange={(e) => handleUpload(idx, e, 'style')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
            <div className="space-y-2 relative">
              <div className="flex justify-between items-center px-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prompt</label>
                <button 
                  onClick={handleMagicWand} 
                  disabled={enhancing || !prompt.trim()}
                  className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
                    enhancing ? 'bg-blue-100 text-blue-500' : 'bg-[#0055b8]/10 text-[#0055b8] hover:bg-[#0055b8]/20'
                  }`}
                >
                  <svg className={`w-3 h-3 ${enhancing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {enhancing ? 'Yaxshilanmoqda...' : 'Magic Prompt'}
                </button>
              </div>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-6 bg-slate-50 rounded-[2rem] text-sm font-bold border-none focus:ring-4 focus:ring-blue-50 h-32 resize-none transition-all shadow-inner"
                placeholder="Mahsulot haqida qisqacha yozing, AI uni professional promptga aylantiradi..."
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="sm:flex-1 p-5 bg-slate-50 rounded-2xl text-xs font-black border-none cursor-pointer">
                <option value="3:4">O'lcham: 3:4 (Portrait)</option>
                <option value="4:3">O'lcham: 4:3 (Landscape)</option>
                <option value="1:1">O'lcham: 1:1 (Kvadrat)</option>
                <option value="16:9">O'lcham: 16:9 (Cinematic)</option>
              </select>
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="sm:flex-[2] bg-[#0055b8] text-white p-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Yaratilmoqda...
                  </>
                ) : "Rasmni Yaratish"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 min-h-[600px] flex flex-col overflow-hidden relative">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Natija</h3>
          </div>
          
          <div className="flex-1 bg-[#f1f5f9] rounded-[3rem] overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-200 relative">
            {loading ? (
              <div className="text-center space-y-6">
                <div className="relative">
                  <div className="animate-spin w-24 h-24 border-8 border-[#0055b8]/10 border-t-[#0055b8] rounded-full mx-auto"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-[#0055b8] italic">{countdown}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-black text-slate-800 uppercase tracking-widest animate-pulse">Tayyorlanmoqda, iltimos kuting</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Processing Image...</p>
                </div>
              </div>
            ) : generatedImage ? (
              <div className="w-full h-full relative group">
                <img src={generatedImage} className="w-full h-full object-contain animate-fadeIn" alt="Result" />
              </div>
            ) : (
              <div className="text-center opacity-30">
                <svg className="w-20 h-20 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Rasm kutilmoqda</p>
              </div>
            )}
          </div>
          
          {generatedImage && (
            <a href={generatedImage} download="umari_result.png" className="mt-8 w-full py-6 bg-[#22c55e] text-white rounded-[2rem] text-center font-black uppercase italic text-xl tracking-widest shadow-2xl hover:bg-green-600 transition-all flex items-center justify-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Yuklab Olish
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceStudio;
