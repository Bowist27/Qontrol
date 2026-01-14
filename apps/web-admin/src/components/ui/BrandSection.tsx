/**
 * BrandSection Component
 * Left side branding with gradient background
 */

const BrandSection: React.FC = () => {
  return (
    <section className="hidden lg:flex flex-1 relative p-12 bg-gradient-to-br from-[#009fdb] via-[#005580] to-slate-900 overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,212,170,0.2)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(0,159,219,0.3)_0%,transparent_50%)]" />

      <div className="relative z-10 h-full flex flex-col justify-center max-w-[500px]">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-white leading-tight mb-6 tracking-tight">
          QONTROL.
        </h1>
        <p className="text-base text-white/70 leading-relaxed">
          Plataforma administrativa centralizada para la gestión de tiendas y auditorías en tiempo real.
        </p>
      </div>
    </section>
  );
};

export default BrandSection;
