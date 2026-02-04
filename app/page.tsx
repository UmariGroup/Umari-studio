import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white text-gray-900 px-4">
      
      {/* Hero Section */}
      <div className="text-center max-w-3xl">
        <h2 className="text-5xl md:text-6xl font-bold mb-6 text-blue-600">
          AI-Powered Marketplace Studio
        </h2>
        <p className="text-xl text-gray-600 mb-4">
          Professional mahsulot ravishlanishi, video yaratish, copywriting va marketing analytics - hammasi AI yordamida
        </p>
        <p className="text-lg text-gray-500 mb-12">
          Rasm 📷 • Video 🎬 • Text 📝 • Analytics 📊
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/admin"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700   rounded-lg font-semibold text-lg transition transform hover:scale-105"
          >
            Boshlash ✨
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-4 border-2 border-blue-400 hover:bg-blue-400/10 rounded-lg font-semibold text-lg transition"
          >
            Narxlarni Ko'rish 💰
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-4xl">
        {[
          {
            icon: "🖼️",
            title: "Professional Rasmlar",
            desc: "4K marketplace-optimized product photography AI yordamida",
          },
          {
            icon: "📹",
            title: "Video Scripts",
            desc: "Production-ready 30-second marketplace video scripts",
          },
          {
            icon: "✍️",
            title: "AI Copywriting",
            desc: "High-converting marketplace descriptions va product copy",
          },
          {
            icon: "📊",
            title: "Marketing Analytics",
            desc: "Deep insights va actionable recommendations",
          },
          {
            icon: "💬",
            title: "AI Consultant",
            desc: "Elite marketplace strategy advisor 24/7",
          },
          {
            icon: "🌍",
            title: "Multi-Language",
            desc: "Uzbek, Russian, English - bilingual support",
          },
        ].map((feature, i) => (
          <div
            key={i}
            className="p-6 bg-white/5 border border-blue-400/20 rounded-lg hover:border-blue-400/50 transition backdrop-blur-sm"
          >
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
            <p className="text-gray-400 text-sm">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-8 mt-20 text-center">
        <div>
          <div className="text-3xl font-bold text-blue-400">9</div>
          <div className="text-gray-400">AI Xizmatlar</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-blue-400">18</div>
          <div className="text-gray-400">Block Tasvir</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-blue-400">∞</div>
          <div className="text-gray-400">Imkoniyatlar</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center text-gray-500 text-sm">
        <p>Umari Studio • AI-Powered Marketplace Solutions 🚀</p>
        <p className="text-xs mt-2">
          Powered by Vertex AI • Next.js • PostgreSQL • Uzbek First 🇺🇿
        </p>
      </footer>
    </main>
  );
}
