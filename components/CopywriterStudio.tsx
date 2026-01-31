
import React, { useState } from 'react';
import { GeminiService } from '../services/gemini';

interface ParsedResult {
  titleUz: string;
  titleRu: string;
  category: string;
  descUz: string;
  descRu: string;
  specs: string;
  seo: string;
}

const CopywriterStudio: React.FC = () => {
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...images];
        newImages[index] = reader.result as string;
        setImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const parseText = (text: string): ParsedResult => {
    const getSection = (key: string) => {
      const regex = new RegExp(`---${key}---([\\s\\S]*?)(?=---[A-Z_]+---|$)`);
      return text.match(regex)?.[1]?.trim() || '';
    };

    return {
      titleUz: getSection('SARLAVHA_UZ'),
      titleRu: getSection('SARLAVHA_RU'),
      category: getSection('KATEGORIYA'),
      descUz: getSection('TAVSIF_UZ'),
      descRu: getSection('TAVSIF_RU'),
      specs: getSection('XUSUSIYATLAR'),
      seo: getSection('SEO'),
    };
  };

  const handleGenerate = async () => {
    const activeImages = images.filter(img => img !== null) as string[];
    if (activeImages.length === 0) {
      alert("Iltimos, kamida bitta mahsulot rasmini yuklang.");
      return;
    }

    setLoading(true);
    setParsedResult(null);
    try {
      const text = await GeminiService.generateMarketplaceDescription(activeImages);
      setParsedResult(parseText(text));
    } catch (error) {
      alert("Xatolik: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copySection = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const ResultCard = ({ title, content, sectionId }: { title: string, content: string, sectionId: string }) => (
    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 relative group transition-all hover:shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
        <button 
          onClick={() => copySection(content, sectionId)}
          className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full transition-all ${
            copiedSection === sectionId ? 'bg-green-500 text-white' : 'bg-white text-[#0055b8] shadow-sm hover:scale-105'
          }`}
        >
          {copiedSection === sectionId ? 'Nusxalandi!' : 'Nusxa olish'}
        </button>
      </div>
      <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed">
        {content || 'Ma'lumot topilmadi'}
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-[#0055b8] rounded-[1.5rem] shadow-xl">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Copywriter Studio</h2>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase mt-1">Nusxa olishga tayyor tovar kartalari</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-blue-50 px-8 py-4 rounded-3xl border border-blue-100">
          <span className="text-xs font-black text-[#0055b8] uppercase tracking-widest italic animate-pulse">Ultra SEO Mode ON</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Mahsulot Rasmlari</h3>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(idx => (
                <div key={idx} className="relative aspect-square rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 transition-all hover:border-[#0055b8] group">
                  {images[idx] ? (
                    <>
                      <img src={images[idx]!} className="w-full h-full object-cover" alt={`Product ${idx}`} />
                      <button onClick={() => {
                        const n = [...images]; n[idx] = null; setImages(n);
                      }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <input type="file" onChange={(e) => handleUpload(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                      <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-[#0055b8] text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? "Tahlil ketyapti..." : "Karta Yaratish"}
          </button>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="bg-white p-20 rounded-[4rem] shadow-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="relative mb-8">
                <div className="w-24 h-24 border-8 border-[#0055b8]/10 rounded-full"></div>
                <div className="absolute inset-0 w-24 h-24 border-8 border-[#0055b8] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter mb-2">AI Tovar Kartasini Yozmoqda</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">Marketplace SEO & Kategoriyalash</p>
            </div>
          ) : parsedResult ? (
            <div className="grid gap-6 animate-fadeIn pb-20">
              <div className="bg-[#0055b8] p-8 rounded-[3rem] text-white shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-70">Tavsiya etilgan Kategoriya</h3>
                   <button 
                     onClick={() => copySection(parsedResult.category, 'cat')}
                     className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md transition-all"
                   >
                     {copiedSection === 'cat' ? 'Nusxalandi!' : 'Kategoriyani nusxalash'}
                   </button>
                </div>
                <p className="text-2xl font-black italic tracking-tighter">{parsedResult.category}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <ResultCard title="Sarlavha (UZ)" content={parsedResult.titleUz} sectionId="tUz" />
                <ResultCard title="Название (RU)" content={parsedResult.titleRu} sectionId="tRu" />
              </div>

              <ResultCard title="Tavsif (UZ)" content={parsedResult.descUz} sectionId="dUz" />
              <ResultCard title="Описание (RU)" content={parsedResult.descRu} sectionId="dRu" />

              <div className="grid md:grid-cols-2 gap-6">
                <ResultCard title="Xususiyatlar" content={parsedResult.specs} sectionId="specs" />
                <ResultCard title="SEO Kalit So'zlar" content={parsedResult.seo} sectionId="seo" />
              </div>
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[4rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center opacity-40">
              <svg className="w-24 h-24 text-slate-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Rasm yuklang va karta yaratish tugmasini bosing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CopywriterStudio;
