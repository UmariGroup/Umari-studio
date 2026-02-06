import Link from "next/link";
import type { IconType } from "react-icons";
import {
  FiBarChart2,
  FiCamera,
  FiEdit3,
  FiFileText,
  FiFlag,
  FiGlobe,
  FiImage,
  FiMessageSquare,
  FiPlay,
  FiVideo,
} from "react-icons/fi";
import { FaCoins, FaRocket } from "react-icons/fa";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-white to-slate-50 text-gray-900 px-4 py-10 sm:py-14">
      {/* Hero Section */}
      <div className="text-center max-w-3xl">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6 text-blue-600">
          AI asosidagi Marketplace Studio
        </h2>
        <p className="text-base sm:text-xl text-gray-600 mb-4">
          Marketplace uchun professional rasm, video, copywriting va marketing tahlili — barchasi AI yordamida
        </p>
        <p className="text-sm sm:text-lg text-gray-500 mb-10 sm:mb-12">
          <span className="inline-flex items-center gap-2">
            <FiCamera aria-hidden className="inline-block" />
            <span>Rasm</span>
          </span>
          <span className="mx-2 text-gray-400">•</span>
          <span className="inline-flex items-center gap-2">
            <FiVideo aria-hidden className="inline-block" />
            <span>Video</span>
          </span>
          <span className="mx-2 text-gray-400">•</span>
          <span className="inline-flex items-center gap-2">
            <FiFileText aria-hidden className="inline-block" />
            <span>Matn</span>
          </span>
          <span className="mx-2 text-gray-400">•</span>
          <span className="inline-flex items-center gap-2">
            <FiBarChart2 aria-hidden className="inline-block" />
            <span>Analitika</span>
          </span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
          <Link
            href="/admin"
            className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-base sm:text-lg transition-transform hover:scale-[1.02] sm:hover:scale-105"
          >
            <span className="inline-flex items-center gap-2">
              <FiPlay aria-hidden />
              <span>Boshlash</span>
            </span>
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 border-2 border-blue-400 text-blue-700 hover:bg-blue-400/10 rounded-lg font-semibold text-base sm:text-lg transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <FaCoins aria-hidden />
              <span>Tariflarni ko‘rish</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div
        id="features"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16 max-w-4xl w-full"
      >
        {[
          {
            Icon: FiImage,
            title: "Professional rasmlar",
            desc: "Marketplace uchun moslashtirilgan mahsulot rasmlari — AI yordamida",
          },
          {
            Icon: FiVideo,
            title: "Video ssenariylar",
            desc: "Marketplace uchun tayyor video ssenariy va g‘oyalar",
          },
          {
            Icon: FiEdit3,
            title: "AI copywriting",
            desc: "Sotuvni oshiruvchi tavsif, sarlavha va product copy",
          },
          {
            Icon: FiBarChart2,
            title: "Marketing analitikasi",
            desc: "Chuqur tahlil va amaliy tavsiyalar",
          },
          {
            Icon: FiMessageSquare,
            title: "AI maslahatchi",
            desc: "Marketplace strategiyasi bo‘yicha 24/7 yordamchi",
          },
          {
            Icon: FiGlobe,
            title: "Ko‘p tilli",
            desc: "O‘zbek, rus, ingliz — ko‘p tilli qo‘llab-quvvatlash",
          },
        ].map((feature: { Icon: IconType; title: string; desc: string }, i) => (
          <div
            key={i}
            className="p-5 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition"
          >
            <div className="text-3xl mb-3">
              <feature.Icon aria-hidden className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
            <p className="text-gray-600 text-sm">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-12 sm:mt-16 text-center max-w-4xl w-full">
        <div>
          <div className="text-3xl font-bold text-blue-600">9</div>
          <div className="text-gray-600 text-sm">AI Xizmatlar</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-blue-600">18</div>
          <div className="text-gray-600 text-sm">Block Tasvir</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-blue-600">∞</div>
          <div className="text-gray-600 text-sm">Imkoniyatlar</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 w-full text-center text-gray-500 text-sm pb-6 pt-6 border-t border-gray-200">
        <p className="inline-flex items-center gap-2 justify-center">
          <span>Umari Studio • AI asosidagi marketplace yechimlari</span>
          <FaRocket aria-hidden />
        </p>
        <p className="text-xs mt-2">
          <span className="inline-flex items-center gap-2 justify-center">
            <span>Vertex AI asosida • Next.js • PostgreSQL • Uzbek-first</span>
            <FiFlag aria-hidden />
          </span>
        </p>
      </footer>
    </main>
  );
}
