
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import MarketplaceStudio from './components/MarketplaceStudio';
import VideoStudio from './components/VideoStudio';
import ChatBot from './components/ChatBot';

const UmariProductionLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 400 220" className={className} xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(100, 20) rotate(-10)">
      <rect x="0" y="20" width="200" height="35" fill="#111827" rx="3" />
      <path d="M20 20L45 55M70 20L95 55M120 20L145 55M170 20L195 55" stroke="white" strokeWidth="12" />
    </g>
    <rect x="100" y="75" width="200" height="12" fill="#111827" rx="2" />
    <text x="200" y="165" textAnchor="middle" style={{ fontSize: '84px', fontWeight: 900, fill: '#111827', fontFamily: 'Inter, sans-serif' }}>UMARI</text>
    <text x="190" y="205" textAnchor="middle" style={{ fontSize: '28px', fontWeight: 500, fill: '#111827', letterSpacing: '0.15em', fontFamily: 'Inter, sans-serif' }}>PRODUCTION</text>
    <circle cx="340" cy="200" r="10" fill="#ef4444" />
  </svg>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.MARKETPLACE);
  const [userBalance, setUserBalance] = useState(5);
  const [showPricing, setShowPricing] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    } else {
      setHasKey(true); // Development muhiti uchun
    }
  };

  const handleOpenKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true); // Key selection race condition bypass
    }
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0055b8] p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl animate-slideUp">
          <UmariProductionLogo className="w-48 mx-auto mb-8" />
          <h1 className="text-2xl font-black text-slate-800 uppercase italic mb-4">Xush kelibsiz!</h1>
          <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
            Ilovadan foydalanish uchun Google Gemini API kalitini tanlashingiz kerak. 
            <br/><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-600 underline">Billing yo'riqnomasi</a>
          </p>
          <button 
            onClick={handleOpenKey}
            className="w-full py-5 bg-[#0055b8] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl active:scale-95"
          >
            API Kalitni Tanlash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] font-sans">
      <aside className="hidden md:flex flex-col w-72 bg-[#0055b8] text-white p-6 space-y-8 fixed h-full shadow-2xl z-20 border-r border-white/10">
        <div className="py-2">
          <div className="w-full bg-white rounded-[2.5rem] p-6 shadow-2xl transform hover:scale-105 transition-all duration-500 cursor-pointer">
            <UmariProductionLogo className="w-full h-auto" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/70">Production Studio AI</p>
          </div>
        </div>

        <div className="p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-blue-100 tracking-widest">Balans</span>
            <span className="text-xs font-black bg-[#22c55e] px-4 py-1.5 rounded-full shadow-xl border border-white/20">{userBalance} dona</span>
          </div>
          <button onClick={() => setShowPricing(true)} className="w-full py-3.5 bg-white text-[#0055b8] rounded-2xl text-[11px] font-black uppercase hover:bg-blue-50 transition-all shadow-xl active:scale-95">To'ldirish</button>
        </div>

        <nav className="flex-1 space-y-2.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as AppView)}
              className={`w-full flex items-center gap-4 px-6 py-4.5 rounded-2xl text-sm font-black transition-all duration-300 ${
                activeView === item.id ? 'bg-white text-[#0055b8] shadow-2xl scale-105 translate-x-1.5' : 'text-white/80 hover:bg-white/10 hover:translate-x-1'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-white/10">
          <button onClick={() => setShowPricing(true)} className="w-full p-5 bg-gradient-to-br from-[#fbbf24] via-[#f97316] to-[#dc2626] rounded-3xl shadow-2xl hover:brightness-110 transition-all group active:scale-95">
            <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Pro Version</p>
            <p className="text-sm font-black text-white uppercase italic group-hover:underline">Cheksiz Imkoniyat</p>
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 p-4 md:p-12 pb-32">
        <div className="max-w-7xl mx-auto">
          {activeView === AppView.MARKETPLACE && <MarketplaceStudio />}
          {activeView === AppView.VIDEO && <VideoStudio />}
          {activeView === AppView.CHAT && <ChatBot />}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0055b8] p-5 z-50 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] flex justify-around">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveView(item.id as AppView)} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${activeView === item.id ? 'bg-white text-[#0055b8] scale-110 shadow-xl' : 'text-white/60'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon} /></svg>
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {showPricing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0f172a]/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white w-full max-w-5xl rounded-[4rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.4)] animate-slideUp border border-slate-100">
            <div className="flex justify-between items-center p-10 border-b border-slate-50">
              <h2 className="text-4xl font-black text-slate-800 uppercase italic tracking-tighter">Premium Plans</h2>
              <button onClick={() => setShowPricing(false)} className="p-3 hover:bg-slate-100 rounded-full transition-all">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-10 md:p-16 grid md:grid-cols-3 gap-10">
              {pricingPlans.map((plan) => (
                <div key={plan.name} className={`relative p-10 rounded-[3rem] border-2 transition-all hover:translate-y-[-10px] ${plan.popular ? 'border-[#0055b8] shadow-3xl bg-blue-50/20' : 'border-slate-100 bg-white shadow-sm'}`}>
                  {plan.popular && <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#0055b8] text-white px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-xl">Best Value</span>}
                  <h3 className="text-2xl font-black text-slate-800 uppercase mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mb-8">
                    <span className="text-4xl font-black text-[#0055b8]">{plan.price}</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase">UZS / MONTH</span>
                  </div>
                  <ul className="space-y-5 mb-10">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-4 text-sm font-bold text-slate-600">
                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center"><svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg></div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl active:scale-95 ${plan.popular ? 'bg-[#0055b8] text-white hover:bg-blue-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>Get Started</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideUp { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

const navItems = [
  { id: AppView.MARKETPLACE, label: 'Market Studio', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: AppView.VIDEO, label: 'Video Studio', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: AppView.CHAT, label: 'AI Yordamchi', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
];

const pricingPlans = [
  { name: 'Boshlang\'ich', price: '0', features: ['5 ta bepul rasm', 'Standart sifat', 'Chat yordamchi'] },
  { name: 'Professional', price: '150,000', features: ['Cheksiz rasm', 'Video generatsiya', '4K sifat', 'Logotip o\'chirish'], popular: true },
  { name: 'Biznes', price: '450,000', features: ['Jamoaviy kirish', 'Shaxsiy menejer', 'API integratsiya'] },
];

export default App;
