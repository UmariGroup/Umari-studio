
import React, { useState } from 'react';
import { GeminiService } from '../services/gemini';

const VideoStudio: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('Mahsulotni aylanib ko\'rsatish, cinematic harakat');
  const [isPortrait, setIsPortrait] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSourceImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!sourceImage) return;
    
    // Mitigate race condition: assume success after triggering openSelectKey
    if (!await GeminiService.checkApiKey()) {
      await GeminiService.openKeySelector();
    }
    
    setLoading(true);
    try {
      // Now generateVideoFromImage is defined in GeminiService
      const result = await GeminiService.generateVideoFromImage(sourceImage, prompt, isPortrait);
      setVideoUrl(result);
    } catch (error) {
      alert("Xatolik: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Video Animatsiya (Veo)</h1>
        <p className="text-gray-500 mt-2">Rasmni jonli videoga aylantiring</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div>
            <h3 className="text-sm font-bold uppercase text-gray-400 mb-3">Asosiy rasm</h3>
            <div className="relative h-64 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
              {sourceImage ? (
                <img src={sourceImage} className="w-full h-full object-contain" alt="Source" />
              ) : (
                <div className="text-center p-4">
                  <p className="text-gray-400 text-sm">Rasm yuklang</p>
                  <input type="file" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Harakat tavsifi</label>
              <input 
                type="text" 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">O'lcham:</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsPortrait(false)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!isPortrait ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  16:9 (Landscape)
                </button>
                <button 
                  onClick={() => setIsPortrait(true)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isPortrait ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  9:16 (TikTok/Reels)
                </button>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={loading || !sourceImage}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${loading || !sourceImage ? 'bg-gray-100 text-gray-400' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'}`}
            >
              {loading ? (
                <><span className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full" /> Video yaratilmoqda...</>
              ) : 'Videoni generatsiya qilish'}
            </button>
            <p className="text-[10px] text-gray-400 text-center italic">Video yaratish bir necha daqiqa vaqt olishi mumkin.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[400px]">
          <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Natijaviy video</h3>
          <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center">
            {loading ? (
              <div className="text-center text-white space-y-3">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent animate-spin rounded-full mx-auto"></div>
                <p className="text-xs">Veo AI ishlamoqda...</p>
              </div>
            ) : videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full object-contain" autoPlay loop />
            ) : (
              <p className="text-gray-600 text-sm">Generatsiya kutilmoqda</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoStudio;
