
import React, { useState } from 'react';
import { GeminiService } from '../services/gemini';

const UmariStudioHeaderLogo: React.FC = () => (
  <svg viewBox="0 0 500 150" className="h-14 w-auto" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(10, 10)">
       <rect x="0" y="20" width="100" height="20" fill="#111827" rx="2" />
       <path d="M10 20L30 40M40 20L60 40M70 20L90 40" stroke="white" strokeWidth="6" />
    </g>
    <text x="120" y="65" style={{ fontSize: '64px', fontWeight: 900, fill: '#111827', fontFamily: 'Inter, sans-serif' }}>UMARI</text>
    <text x="120" y="105" style={{ fontSize: '28px', fontWeight: 500, fill: '#111827', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>PRODUCTION</text>
    <circle cx="390" cy="95" r="8" fill="#ef4444" />
  </svg>
);

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
      alert(error instanceof Error ? error.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickEdit = async (instruction: string) => {
    if (!generatedImage) return;
    setLoading(true);
    try {
      const result = await GeminiService.editImage(generatedImage, instruction);
      setGeneratedImage(result);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Tahrirlashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <UmariStudioHeaderLogo />
          <div className="hidden md:block w-px h-12 bg-slate-100 mx-4"></div>
          <div className="space-y-1">
            <h2 className