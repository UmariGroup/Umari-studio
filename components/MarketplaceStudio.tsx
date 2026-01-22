
import React, { useState } from 'react';
import { GeminiService } from '../services/gemini';

const MarketplaceStudio: React.FC<{ userBalance: number; setUserBalance: React.Dispatch<React.SetStateAction<number>>; openPricing: () => void }> = ({ userBalance, setUserBalance, openPricing }) => {
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

              </button>
            </div>
            {userBalance <= 5 && (
              <p className="text-xs text-yellow-700 font-black mt-3">Faqat {userBalance} dona qoldi — tezroq <button onClick={openPricing} className="underline">Pro versiyani sotib oling</button></p>
            )}
          </div>

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* Dynamic Workspace Header */}
      <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-slate-900 rounded-[1.5rem] shadow-xl">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path></svg>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Market Studio</h2>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase mt-1">AI-Powered Generation Engine</p>
          </div>
        </div>
        {userBalance <= 5 && (
          <div className="absolute top-4 right-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-lg animate-pulse">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
            <span className="text-xs font-black uppercase tracking-tighter">{userBalance} dona qoldi — <button onClick={openPricing} className="underline">Pro versiyani sotib oling</button></span>
          </div>
        )}
        <div className="flex items-center gap-4 bg-[#0055b8]/5 px-8 py-4 rounded-3xl border border-blue-100">
          <div className="relative flex">
            <span className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 scale-150"></span>
            <span className="relative block w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></span>
          </div>
          <span className="text-xs font-black text-[#0055b8] uppercase tracking-widest italic">System Ready</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-10 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-8">
          
          {/* Upload Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                <span className="w-6 h-6 bg-[#0055b8] text-white rounded-full flex items-center justify-center font-black">1</span>
                Mahsulot Burchaklari
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="relative aspect-square group">
                    <div className={`w-full h-full rounded-2xl border-2 border-dashed transition-all overflow-hidden flex items-center justify-center ${productImages[idx] ? 'border-transparent shadow-md' : 'border-slate-100 bg-slate-50 group-hover:border-[#0055b8]'}`}>
                      {productImages[idx] ? (
                        <img src={productImages[idx]!} className="w-full h-full object-cover" alt="Angle" />
                      ) : (
                        <div className="text-center p-2">
                          <svg className="w-6 h-6 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                          <input type="file" onChange={(e) => handleUploadProduct(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center font-black">2</span>
                Uslub (Reference)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="relative aspect-square group">
                    <div className={`w-full h-full rounded-2xl border-2 border-dashed transition-all overflow-hidden flex items-center justify-center ${styleImages[idx] ? 'border-transparent shadow-md' : 'border-slate-100 bg-slate-50 group-hover:border-slate-900'}`}>
                      {styleImages[idx] ? (
                        <img src={styleImages[idx]!} className="w-full h-full object-cover" alt="Style" />
                      ) : (
                        <div className="text-center p-2">
                          <svg className="w-6 h-6 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                          <input type="file" onChange={(e) => handleUploadStyle(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Prompting & Ratio */}
          <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-8">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Ijodiy buyruq</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-[#0055b8] outline-none h-32 resize-none transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Mahsulot haqida batafsil yozing..."
              />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-1/3 space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Aspect Ratio</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none hover:border-[#0055b8] transition-all cursor-pointer shadow-sm">
                  <option value="3:4">3:4 Portrait</option>
                  <option value="4:3">4:3 Landscape</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className={`w-full md:w-2/3 py-6 mt-6 rounded-[2.5rem] font-black text-xl transition-all flex items-center justify-center gap-4 active:scale-95 shadow-3xl ${loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#0055b8] text-white hover:bg-blue-700 shadow-blue-200'}`}
              >
                {loading ? (
                  <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="uppercase italic tracking-tighter">Ishni boshlash</span>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result Column */}
        <div className="lg:col-span-6 bg-white p-10 rounded-[4rem] shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col space-y-10 min-h-[700px]">
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">Premium Natija</h3>
            {generatedImage && <span className="text-[10px] font-black bg-green-100 text-green-700 px-5 py-2 rounded-full uppercase tracking-widest">Completed</span>}
          </div>

          <div className="flex-1 relative bg-slate-50 rounded-[3rem] overflow-hidden border border-slate-100 flex items-center justify-center group shadow-inner">
            {loading ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto">
                   <div className="w-10 h-10 border-4 border-[#0055b8] border-t-transparent animate-spin rounded-full"></div>
                </div>
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] animate-pulse">Multimodal Processing...</p>
              </div>
            ) : generatedImage ? (
              <img src={generatedImage} className="w-full h-full object-contain animate-fadeIn" alt="Result" />
            ) : (
              <div className="text-center px-12 space-y-6 opacity-30">
                <svg className="w-24 h-24 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p className="text-xs font-black uppercase tracking-[0.5em] text-slate-400 italic">Render View kutilmoqda</p>
              </div>
            )}
          </div>

          {generatedImage && (
            <a 
              href={generatedImage} 
              download="umari_studio_hd.png" 
              className="w-full py-7 bg-[#22c55e] text-white rounded-[2.5rem] text-center font-black uppercase italic text-2xl tracking-widest shadow-2xl shadow-green-100 hover:bg-green-600 hover:translate-y-[-5px] transition-all active:scale-95"
            >
              Yuklab Olish
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceStudio;
