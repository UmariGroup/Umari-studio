
import React, { useState } from 'react';
import { GeminiService } from '../services/gemini';

const MarketplaceStudio: React.FC = () => {
  const [productImages, setProductImages] = useState<(string | null)[]>([null, null, null]);
  const [styleImages, setStyleImages] = useState<(string | null)[]>([null, null, null]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('3:4');

  const handleUploadProduct = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...productImages];
        newImages[index] = reader.result as string;
        setProductImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadStyle = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...styleImages];
        newImages[index] = reader.result as string;
        setStyleImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    const activeProducts = productImages.filter(img => img !== null) as string[];
    
    if (activeProducts.length === 0) {
      alert("Iltimos, mahsulot rasmini yuklang.");
      return;
    }

    setLoading(true);
    try {
      // Rasm generatsiyasi Flash modeli bilan BEPUL ishlaydi
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
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase mt-1">Free AI Production</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-green-50 px-8 py-4 rounded-3xl border border-green-100">
          <span className="text-xs font-black text-green-600 uppercase tracking-widest italic">Bepul Rejim Faol</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Mahsulot</h3>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="relative aspect-square rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 transition-all hover:border-[#0055b8]">
                    {productImages[idx] ? (
                      <img src={productImages[idx]!} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <input type="file" onChange={(e) => handleUploadProduct(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Uslub</h3>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="relative aspect-square rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 transition-all">
                    {styleImages[idx] ? (
                      <img src={styleImages[idx]!} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <input type="file" onChange={(e) => handleUploadStyle(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Prompt</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-6 bg-slate-50 rounded-[2rem] text-sm border-none focus:ring-4 focus:ring-blue-50 h-32 resize-none transition-all shadow-inner"
                placeholder="Mahsulot tavsifini yozing..."
              />
            </div>
            
            <div className="flex gap-4">
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-black border-none cursor-pointer">
                <option value="3:4">3:4</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="flex-[2] bg-[#0055b8] text-white p-4 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
              >
                {loading ? "AI yaratmoqda..." : "Rasmni Yaratish"}
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
              <div className="text-center space-y-4">
                <div className="animate-spin w-16 h-16 border-4 border-[#0055b8] border-t-transparent rounded-full mx-auto"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processing...</p>
              </div>
            ) : generatedImage ? (
              <div className="w-full h-full relative group">
                <img src={generatedImage} className="w-full h-full object-contain pointer-events-none animate-fadeIn" alt="Result" />
                <div className="absolute inset-0 pointer-events-none"></div>
              </div>
            ) : (
              <div className="text-center opacity-30">
                <svg className="w-20 h-20 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Rasm kutilmoqda</p>
              </div>
            )}
          </div>
          
          {generatedImage && (
            <a href={generatedImage} download="umari_result.png" className="mt-8 w-full py-6 bg-[#22c55e] text-white rounded-[2rem] text-center font-black uppercase italic text-xl tracking-widest shadow-2xl hover:bg-green-600 transition-all">Yuklab Olish</a>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
      `}</style>
    </div>
  );
};

export default MarketplaceStudio;
