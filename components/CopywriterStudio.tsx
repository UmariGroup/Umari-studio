
import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from '../services/gemini';

const MARKETPLACES = ['Uzum Market', 'ANAMARKET', 'Yandex', 'Ozon', 'WB'];

const FIELD_LABELS: Record<string, string> = {
  CAT: '1. Kategoriya / Категория',
  NAME: '2. Mahsulot nomi / Название',
  COUNTRY: '3. Ishlab chiqarilgan davlat / Страна',
  BRAND: '4. Brend / Brend',
  MODEL: '5. Model / Модель',
  WARRANTY: '6. Kafolat / Гарантия',
  SHORT_DESC: '7. Qisqa tavsif / Краткое описание',
  FULL_DESC: '8. To\'liq tavsif / Полное описание',
  PHOTOS_INFO: '9. Rasmlar bo\'yicha tavsiya / Фотографии',
  VIDEO_REC: '10. Video tavsiyalar / Видео',
  SPECS: '11. Xususiyatlar / Характеристики',
  PROPS: '12. Mahsulot afzalliklari / Свойства',
  INSTR: '13. Yo\'riqnoma / Инструкция',
  SIZE: '14. O\'lchamlar / Размерная сетка',
  COMP: '15. Tarkibi / Состав',
  CARE: '16. Parvarishlash / Уход',
  SKU: '17. SKU KOD',
  IKPU: '18. IKPU (ИКПУ)'
};

const TECHNICAL_DESC: Record<string, string> = {
  SKU: "Mahsulotni inventarizatsiya qilish va omborda aniqlash uchun ishlatiladigan noyob identifikator.",
  IKPU: "O'zbekiston Respublikasi mahsulot va xizmatlarning yagona elektron tasniflagichi (Soliq tizimi uchun zarur)."
};

const CopywriterStudio: React.FC = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState(MARKETPLACES[0]);
  const [images, setImages] = useState<string[]>([]);
  const [categoryRef, setCategoryRef] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const accumulatedText = useRef('');

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setInterval(() => setCountdown(prev => (prev > 1 ? prev - 1 : 1)), 1000);
    } else {
      setCountdown(10);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const remaining = 3 - images.length;
      const fileList = Array.from(files).slice(0, remaining) as File[];
      fileList.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setImages(prev => [...prev, reader.result as string].slice(0, 3));
        reader.readAsDataURL(file);
      });
    }
  };

  const parseIncremental = (text: string) => {
    const data: Record<string, string> = {};
    const keys = Object.keys(FIELD_LABELS);
    keys.forEach((key, index) => {
      const nextKey = keys[index + 1];
      const regex = new RegExp(`---${key}---([\\s\\S]*?)(?=---${nextKey}---|$)`);
      const match = text.match(regex);
      if (match) {
        data[key] = match[1].trim();
      }
    });
    return data;
  };

  const handleGenerate = async () => {
    if (images.length === 0) return alert("Iltimos, rasm yuklang.");
    
    setLoading(true);
    setResults({});
    accumulatedText.current = '';
    
    try {
      const stream = GeminiService.generateMarketplaceDescriptionStream(images, selectedMarketplace, categoryRef);
      for await (const chunk of stream) {
        if (chunk) {
          accumulatedText.current += chunk;
          setResults(parseIncremental(accumulatedText.current));
        }
      }
    } catch (error) {
      alert("Xatolik: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const cleanLangText = (text: string, lang: 'UZ' | 'RU') => {
    if (!text) return '';
    const uzPart = text.split(/RU:/i)[0].replace(/UZ:/i, '').trim();
    const ruPart = (text.split(/RU:/i)[1] || '').trim();
    return (lang === 'UZ' ? uzPart : ruPart).replace(/[*#_~]/g, '');
  };

  const copyToClipboard = (text: string, key: string, lang?: 'UZ' | 'RU') => {
    let final = text;
    if (lang) {
      final = cleanLangText(text, lang);
    } else {
      // For technical fields, just take the first meaningful line or the whole thing
      final = text.replace(/UZ:|RU:/gi, '').trim().split('\n')[0];
    }
    
    if (!final) return;
    navigator.clipboard.writeText(final);
    setCopiedKey(lang ? `${key}-${lang}` : key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-40 animate-fadeIn">
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap gap-2">
          {MARKETPLACES.map(mp => (
            <button 
              key={mp} 
              onClick={() => setSelectedMarketplace(mp)}
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedMarketplace === mp ? 'bg-[#0055b8] text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {mp}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Streaming AI faol</span>
        </div>
      </section>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Rasmlar</h3>
              <span className="text-xs font-black text-[#0055b8]">{images.length}/3</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-md group">
                  <img src={img} className="w-full h-full object-cover" />
                  <button onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {images.length < 3 && (
                <div className="relative aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer">
                  <input type="file" onChange={handleUpload} multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Ma'lumotlar</h3>
            <textarea 
              value={categoryRef} 
              onChange={(e) => setCategoryRef(e.target.value)}
              placeholder="Mahsulot haqida ma'lumot kiriting..."
              className="w-full p-5 bg-slate-50 rounded-2xl text-xs font-bold border-none h-40 resize-none outline-none focus:ring-4 focus:ring-blue-50 transition-all"
            />
          </div>

          <button 
            onClick={handleGenerate} 
            disabled={loading}
            className="w-full bg-[#0055b8] text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? `GENERATSIYA: ${countdown}` : "MA'LUMOTLARNI YARATISH"}
          </button>
        </div>

        <div className="lg:col-span-8">
          {Object.keys(results).length > 0 ? (
            <div className="space-y-6">
              {Object.keys(FIELD_LABELS).filter(k => k !== 'SKU' && k !== 'IKPU').map(key => (
                results[key] && (
                  <div key={key} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all animate-fadeIn">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{FIELD_LABELS[key]}</h4>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => copyToClipboard(results[key], key, 'UZ')}
                          className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${
                            copiedKey === `${key}-UZ` ? 'bg-green-500 text-white' : 'bg-blue-50 text-[#0055b8] hover:bg-blue-100'
                          }`}
                        >
                          {copiedKey === `${key}-UZ` ? 'OK!' : 'Nusxa olish'}
                        </button>
                        <button 
                          onClick={() => copyToClipboard(results[key], key, 'RU')}
                          className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${
                            copiedKey === `${key}-RU` ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {copiedKey === `${key}-RU` ? 'OK!' : 'Копировать'}
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">
                      <div className="mb-4 pb-4 border-b border-slate-50">
                        {cleanLangText(results[key], 'UZ')}
                      </div>
                      <div className="text-slate-400 italic font-medium">
                        {cleanLangText(results[key], 'RU')}
                      </div>
                    </div>
                  </div>
                )
              ))}

              {(results['SKU'] || results['IKPU']) && (
                <div className="mt-16 pt-16 border-t-4 border-double border-slate-200 grid md:grid-cols-2 gap-6">
                  {['SKU', 'IKPU'].map(key => (
                    results[key] && (
                      <div key={key} className="bg-slate-900 p-10 rounded-[3rem] text-white border-4 border-slate-800 shadow-2xl animate-fadeIn relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{FIELD_LABELS[key]}</span>
                            <p className="text-[9px] text-blue-300/60 font-medium mt-1 leading-tight max-w-[160px]">
                              {TECHNICAL_DESC[key]}
                            </p>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(results[key], key)} 
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                              copiedKey === key ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                            }`}
                          >
                            {copiedKey === key ? 'OK!' : 'Nusxa olish'}
                          </button>
                        </div>
                        <div className="text-2xl font-black text-blue-400 font-mono tracking-tighter break-all">
                          {results[key].replace(/UZ:|RU:/gi, '').trim().split('\n')[0]}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-24 rounded-[4rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center opacity-40">
              <svg className="w-20 h-20 text-slate-200 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] italic">Generatsiyani boshlash uchun rasm yuklang</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CopywriterStudio;
