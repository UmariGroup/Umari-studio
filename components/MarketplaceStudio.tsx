
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
    const activeStyles = styleImages.filter(img => img !== null) as string[];
    
    if (activeProducts.length === 0) {
      alert("Iltimos, kamida bitta mahsulot rasmini yuklang.");
      return;
    }

    setLoading(true);
    try {
      const result = await GeminiService.generateMarketplaceImage(
        prompt, 
        activeProducts, 
        activeStyles,
        aspectRatio
      );
      setGeneratedImage(result);
    } catch (error) {
      const msg = (error as Error).message;
      alert("Xatolik: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-slate-900 rounded-[1.5rem] shadow-xl">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path></svg>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Market Studio</h2>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase mt-1">AI Production Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-[#0055b8]/5 px-8 py-4 rounded-3xl border border-blue-100">
          <span className="text-xs font-black text-[#0055b8] uppercase tracking-widest italic">Tayyor</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Mahsulot</h3>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="relative aspect-square rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50">
                    {productImages[idx] ? <img src={productImages[idx]!} className="w-full h-full object-cover" /> : <input type="file" onChange={(e) => handleUploadProduct(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" />}
                    {!productImages[idx] && <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Uslub</h3>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="relative aspect-square rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50">
                    {styleImages[idx] ? <img src={styleImages[idx]!} className="w-full h-full object-cover" /> : <input type="file" onChange={(e) => handleUploadStyle(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" />}
                    {!styleImages[idx] && <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-6 bg-slate-50 rounded-3xl text-sm border-none focus:ring-2 focus:ring-[#0055b8] h-32"
              placeholder="Tavsif yozing (masalan: oq fonda, cinematic lighting)..."
            />
            <div className="flex gap-4">
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none">
                <option value="3:4">3:4</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="flex-[2] bg-[#0055b8] text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loading ? "Yaratilmoqda..." : "Yaratish"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 min-h-[600px] flex flex-col">
          <h3 className="text-xl font-black text-slate-800 uppercase italic mb-6">Natija</h3>
          <div className="flex-1 bg-slate-50 rounded-3xl overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-100">
            {loading ? (
              <div className="animate-spin w-10 h-10 border-4 border-[#0055b8] border-t-transparent rounded-full"></div>
            ) : generatedImage ? (
              <img src={generatedImage} className="w-full h-full object-contain" />
            ) : (
              <p className="text-slate-300 font-bold italic">Rasm kutilmoqda</p>
            )}
          </div>
          {generatedImage && (
            <a href={generatedImage} download="umari_result.png" className="mt-6 w-full py-5 bg-[#22c55e] text-white rounded-3xl text-center font-black uppercase tracking-widest">Yuklab Olish</a>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceStudio;
