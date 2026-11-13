"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

export interface HeroSlide {
  key: string;
  eyebrow: string;
  headline: string;
  text: string;
  cta: { href: string; label: string };
  image: { src: string; alt: string } | null;
}

const INTERVAL_MS = 6500;
const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Home hero: one slide per category, cross-fading. Pauses on hover and focus,
 * and does not rotate at all with prefers-reduced-motion (WCAG 2.2.2).
 */
export function HeroSlider({ slides, labels }: { slides: HeroSlide[]; labels: { prev: string; next: string; /** "Слайд {n} от {total}" */ slide: string; pause: string; play: string } }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => true);

  useEffect(() => {
    if (paused || userPaused || reduced || slides.length < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, userPaused, reduced, slides.length]);

  const go = (i: number) => setIndex((i + slides.length) % slides.length);

  return (
    <section
      aria-roledescription="carousel"
      className="relative overflow-hidden bg-[#F3ECE1]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="container-site relative grid min-h-[620px] items-center lg:min-h-[560px]">
        {slides.map((s, i) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={labels.slide.replace("{n}", String(i + 1)).replace("{total}", String(slides.length))}
            aria-hidden={i !== index}
            inert={i !== index}
            className={`col-start-1 row-start-1 grid items-center gap-8 py-10 transition-opacity duration-700 motion-reduce:transition-none lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-14 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className="order-2 flex flex-col gap-5 lg:order-1">
              <p className="eyebrow text-accent-600">{s.eyebrow}</p>
              {i === 0 ? <h1 className="h1 max-w-xl">{s.headline}</h1> : <p className="h1 max-w-xl">{s.headline}</p>}
              <p className="max-w-lg text-[18px] leading-relaxed text-ink-2">{s.text}</p>
              <div>
                <Link href={s.cta.href} className="btn btn-primary btn-lg">
                  {s.cta.label}
                </Link>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              {s.image ? (
                <Link href={s.cta.href} tabIndex={-1} className="relative mx-auto block aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_60px_-30px_rgba(42,31,26,0.45)] lg:aspect-[5/4]">
                  <Image src={s.image.src} alt={s.image.alt} fill priority={i === 0} sizes="(min-width: 1024px) 560px, 100vw" className="object-contain p-5" />
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <div className="container-site flex items-center gap-3 pb-8">
          <button type="button" onClick={() => go(index - 1)} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:border-ink" aria-label={labels.prev}>
            ‹
          </button>
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-label={labels.slide.replace("{n}", String(i + 1)).replace("{total}", String(slides.length))}
                aria-current={i === index ? "true" : undefined}
                className="grid h-11 w-8 place-items-center"
              >
                <span className={`block h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-ink" : "w-4 bg-ink/25"}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:border-ink" aria-label={labels.next}>
            ›
          </button>
          {!reduced ? (
            <button type="button" onClick={() => setUserPaused((p) => !p)} className="ml-2 text-[14px] font-semibold text-ink-2 underline underline-offset-4">
              {userPaused ? labels.play : labels.pause}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
