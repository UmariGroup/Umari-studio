
import React, { useState } from 'react';
import { AppView } from './types';
import MarketplaceStudio from './components/MarketplaceStudio';
import VideoStudio from './components/VideoStudio';
import ChatBot from './components/ChatBot';
import CopywriterStudio from './components/CopywriterStudio';

const navItems = [
  { id: AppView.MARKETPLACE, label: 'Market Studio', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: AppView.COPYWRITER, label: 'Copywriter Studio', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: AppView.VIDEO, label: 'Video Studio', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: AppView.CHAT, label: 'AI Yordamchi', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
];

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] font-sans">
      <aside className="hidden md:flex flex-col w-72 bg-[#0055b8] text-white p-6 space-y-8 fixed h-full shadow-2xl z-20 border-r border-white/10">
        <div className="py-2">
          <div className="w-full bg-white rounded-[2.5rem] p-6 shadow-2xl transform hover:scale-105 transition-all duration-500 cursor-pointer">
            <UmariProductionLogo className="w-full h-auto" />
          </div>
        </div>

        <nav className="flex-1 space-y-2.5 pt-8">
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

        <div className="pt-6 border-t border-white/10 opacity-50">
          <p className="text-[10px] text-center font-black uppercase tracking-widest">© 2024 Umari Production</p>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 p-4 md:p-12 pb-32">
        <div className="max-w-7xl mx-auto">
          {activeView === AppView.MARKETPLACE && <MarketplaceStudio />}
          {activeView === AppView.COPYWRITER && <CopywriterStudio />}
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

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
