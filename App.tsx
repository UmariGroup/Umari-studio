
import React, { useState } from 'react';
import { AppView } from './types';
import MarketplaceStudio from './components/MarketplaceStudio';
import VideoStudio from './components/VideoStudio';
import ChatBot from './components/ChatBot';

// Professional SVG Logotip - Siz yuborgan PNG nusxasi
const UmariProductionLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 500 280" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Clapperboard Top Part */}
    <g transform="translate(140, 30) rotate(-5)">
      <rect x="0" y="25" width="220" height="45" fill="#111827" rx="4" />
      <path d="M20 25L50 70M70 25L100 70M120 25L150 70M170 25L200 70" stroke="white" strokeWidth="15" />
    </g>
    {/* Clapperboard Bottom Part */}
    <rect x="140" y="85" width="220" height="15" fill="#111827" rx="2" />
    
    {/* Text: UMARI */}
    <text x="250" y="185" textAnchor="middle" style={{ fontSize: '100px', fontWeight: 900, fill: '#111827', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>UMARI</text>
    
    {/* Text: PRODUCTION */}
    <text x="240" y="235" textAnchor="middle" style={{ fontSize: '42px', fontWeight: 500, fill: '#111827', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif' }}>PRODUCTION</text>
    
    {/* Red Record Dot */}
    <circle cx="365" cy="225" r="12" fill="#ef4444" />
  </svg>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.MARKETPLACE);
  const [userBalance, setUserBalance] = useState(5);
  const [showPricing, setShowPricing] = useState(false);

  const navItems = [
    { id: AppView.MARKETPLACE, label: 'Market Studio', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: AppView.VIDEO, label: 'Video Studio', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { id: AppView.CHAT, label: 'AI Yordamchi', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  ];

  const pricingPlans = [
    { name: 'Boshlang\'ich', price: '0', features: ['5 ta bepul rasm', 'Standart sifat', 'Chat yordamchi'], color: 'slate' },
    { name: 'Professional', price: '150,000', features: ['Cheksiz rasm', 'Video generatsiya', '4K sifat', 'Logotip o\'chirish'], color: 'blue', popular: true },
    { name: 'Biznes', price: '450,000', features: ['Jamoaviy kirish', 'Shaxsiy menejer', 'API integratsiya'], color: 'purple' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0055b8] text-white p-6 space-y-8 fixed h-full shadow-2xl z-20">
        
        {/* LOGO AREA */}
        <div className="py-2 flex flex-col items-center">
          <div className="w-full bg-white rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] transform hover:scale-105 transition-all duration-500 cursor-pointer group">
            <UmariProductionLogo className="w-full h-auto" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100">Official Studio</p>
          </div>
        </div>

        <div className="p-4 bg-white/10 rounded-3xl border border-white/20 backdrop-blur-md space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-blue-200 tracking-wider">Hisob Balansi</span>
            <span className="text-xs font-bold bg-[#22c55e] px-3 py-1 rounded-full shadow-lg border border-white/20">{userBalance} dona</span>
          </div>
          <button 
            onClick={() => setShowPricing(true)}
            className="w-full py-3 bg-white text-[#0055b8] rounded-2xl text-[11px] font-black uppercase hover:scale-105 transition-all shadow-xl active:scale-95"
          >
            Balansni To'ldirish
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as AppView)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${
                activeView === item.id 
                  ? 'bg-white text-[#0055b8] shadow-2xl scale-105 translate-x-2' 
                  : 'text-blue-50 hover:bg-white/10 hover:translate-x-1'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-white/10">
          <button 
            onClick={() => setShowPricing(true)}
            className="w-full p-5 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 rounded-3xl shadow-2xl hover:brightness-110 transition-all group active:scale-95"
          >
            <p className="text-[10px] font-black text-white/90 uppercase tracking-widest">Premium Status</p>
            <p className="text-sm font-black text-white uppercase italic group-hover:underline">PRO Rejaga O'tish</p>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-4 md:p-10 pb-28">
        <div className="max-w-7xl mx-auto">
          {activeView === AppView.MARKETPLACE && <MarketplaceStudio />}
          {activeView === AppView.VIDEO && <VideoStudio />}
          {activeView === AppView.CHAT && <ChatBot />}
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0055b8] text-white flex justify-around p-4 z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as AppView)}
            className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
              activeView === item.id ? 'bg-white text-[#0055b8] scale-110' : 'text-blue-100'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
            </svg>
            <span className="text-[9px] font-black uppercase">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {/* Pricing Modal */}
      {showPricing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl animate-slideUp">
            <div className="flex justify-between items-center p-8 border-b">
              <h2 className="text-3xl font-black text-slate-800 uppercase italic">Tariflar va Balans</h2>
              <button onClick={() => setShowPricing(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-8 md:p-12 grid md:grid-cols-3 gap-8">
              {pricingPlans.map((plan) => (
                <div key={plan.name} className={`relative p-8 rounded-[2.5rem] border-2 transition-all hover:scale-105 ${plan.popular ? 'border-[#0055b8] shadow-2xl bg-blue-50/30' : 'border-slate-100 bg-white'}`}>
                  {plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#0055b8] text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Eng mashhur</span>}
                  <h3 className="text-xl font-black text-slate-800 uppercase mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-black text-[#0055b8]">{plan.price}</span>
                    <span className="text-xs text-slate-400 font-bold uppercase">so'm / oy</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${plan.popular ? 'bg-[#0055b8] text-white shadow-xl hover:bg-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Tanlash
                  </button>
                </div>
              ))}
            </div>
            <div className="p-8 bg-slate-50 text-center">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Xavfsiz to'lov tizimlari orqali: Payme / Click</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default App;
