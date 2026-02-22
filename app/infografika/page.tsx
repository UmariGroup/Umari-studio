import InfografikaClient from './InfografikaClient.tsx';

export const metadata = {
  title: 'Infografika - Umari AI',
};

export default function InfografikaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
      </div>
      <div className="relative">
        <InfografikaClient />
      </div>
    </div>
  );
}
