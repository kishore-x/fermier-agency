export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <section className="bg-[linear-gradient(180deg,#0a0d14_0%,#1b1f27_100%)] text-white">
      <div className="container-site py-10">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#3a95f7]">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[34px] font-bold uppercase leading-tight tracking-tight">{title}</h1>
        {text && <p className="mt-2 max-w-2xl text-sm text-white/80">{text}</p>}
      </div>
    </section>
  );
}
