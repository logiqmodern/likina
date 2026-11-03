"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { saveConsentAction } from "@/app/_actions/analytics";
import { IconClose } from "@/components/icons";
import { persistAttribution } from "@/lib/analytics/attribution-store";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_S, parseConsent, readCookie } from "@/lib/analytics/consent";
import { readConsent, syncTrackers, withdrawConsent } from "@/lib/analytics/loader";
import { CONSENT_CHANGED_EVENT, OPEN_COOKIE_SETTINGS_EVENT } from "./ui-events";

/*
 * Cookie banner (§9.1). Compact, at the bottom; on phones above the mobile
 * action bar so it never covers „Запиши час“ / „Обади се“. „Приемам всички“,
 * „Отказвам“ and „Настройки“ look exactly the same (no nudging). Non-modal:
 * the page stays usable and focus is not trapped. Shown until the visitor
 * has a valid choice for the current CONSENT_VERSION; the footer link
 * „Настройки за бисквитки“ reopens it in the settings view.
 *
 * Fixed position (no layout shift); its height is published as
 * --cookie-banner-h so sticky bottom CTAs (booking flow) can sit above it.
 */

type Choice = { analytics: boolean; marketing: boolean };

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
}
const getSnapshot = () => readCookie(document.cookie, CONSENT_COOKIE) ?? "";
/** On the server (and while hydrating) the choice is unknown → no banner in the static HTML. */
const getServerSnapshot = () => null;

const BUTTON = "btn btn-secondary min-h-12 w-full px-2 text-[15px] leading-tight disabled:cursor-wait disabled:opacity-70";

const CATEGORIES: Array<{ key: keyof Choice | "necessary"; title: string; text: string }> = [
  {
    key: "necessary",
    title: "Необходими",
    text: "Нужни са, за да работи сайтът: запазване на час, сигурност и запомняне на този избор.",
  },
  {
    key: "analytics",
    title: "Аналитични",
    text: "Google Analytics 4: обобщена статистика колко хора посещават сайта и кои страници ползват.",
  },
  {
    key: "marketing",
    title: "Маркетингови",
    text: "Meta Pixel и Google Ads: измерване и показване на реклами във Facebook, Instagram и Google.",
  },
];

export function CookieBanner({ aboveBottomBar = false }: { aboveBottomBar?: boolean }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const undecided = raw !== null && parseConsent(raw) === null;

  const [reopened, setReopened] = useState(false);
  const [view, setView] = useState<"summary" | "settings">("summary");
  const [choice, setChoice] = useState<Choice>({ analytics: false, marketing: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const moveFocus = useRef(false);

  const visible = reopened || undecided;

  // Footer / cookie page: reopen in the settings view with the current choice.
  useEffect(() => {
    const onOpen = () => {
      const current = readConsent();
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      moveFocus.current = true;
      setChoice({ analytics: !!current?.analytics, marketing: !!current?.marketing });
      setError(null);
      setView("settings");
      setReopened(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
  }, []);

  // Focus follows an explicit action (reopen, switching views) — never on the first, unprompted show.
  useEffect(() => {
    if (!visible || !moveFocus.current) return;
    moveFocus.current = false;
    headingRef.current?.focus();
  }, [visible, view]);

  // Publish the height for sticky bottom CTAs.
  useEffect(() => {
    const root = document.documentElement;
    const el = panelRef.current;
    if (!visible || !el) {
      root.style.removeProperty("--cookie-banner-h");
      return;
    }
    const update = () => root.style.setProperty("--cookie-banner-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--cookie-banner-h");
    };
  }, [visible, view]);

  if (!visible) return null;

  function close() {
    setReopened(false);
    setView("summary");
    setError(null);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
  }

  function showSettings() {
    const current = readConsent();
    setChoice({ analytics: !!current?.analytics, marketing: !!current?.marketing });
    moveFocus.current = true;
    setView("settings");
  }

  function back() {
    if (reopened) return close();
    moveFocus.current = true;
    setView("summary");
  }

  async function save(next: Choice) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const previous = readConsent();
    try {
      const { value } = await saveConsentAction(next);
      // The server sets the cookie; if the browser dropped it (e.g. a Secure cookie on plain http), set it here.
      if (readCookie(document.cookie, CONSENT_COOKIE) !== value) {
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
      }
      // Something withdrawn → its cookies are deleted and the page reloads without the scripts.
      if (withdrawConsent(previous, next)) return;
      const saved = parseConsent(value);
      syncTrackers(saved);
      persistAttribution(saved);
      setBusy(false);
      if (reopened) close();
      else setView("summary");
      window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
    } catch {
      setBusy(false);
      setError("Не успяхме да запазим избора ти. Опитай пак.");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || view !== "settings") return;
    e.stopPropagation();
    back();
  }

  const headingId = `${uid}-title`;
  const position = aboveBottomBar
    ? "bottom-[var(--bottom-bar-h)] pb-2 lg:bottom-0 lg:pb-6"
    : "bottom-0 pb-[max(8px,env(safe-area-inset-bottom))] lg:pb-6";

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      className={`pointer-events-none fixed inset-x-0 z-50 px-2 lg:px-6 ${position}`}
    >
      <div
        ref={panelRef}
        className="pointer-events-auto mx-auto max-h-[calc(100dvh-var(--bottom-bar-h)-16px)] max-w-[1120px] overflow-y-auto rounded-[20px] border border-line bg-white p-4 shadow-[0_-4px_30px_rgba(43,26,38,0.16)] lg:max-h-[calc(100dvh-48px)] lg:p-6"
      >
        {view === "summary" ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="flex flex-col gap-1">
              <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-[17px] font-extrabold focus:outline-none">
                Бисквитки
              </h2>
              <p className="text-[15px] leading-snug text-ink-2">
                Необходимите бисквитки са нужни, за да работи сайтът. С твое съгласие ползваме и бисквитки за статистика
                и за реклами.{" "}
                <Link href="/biskvitki" className="link whitespace-nowrap">
                  Повече за бисквитките
                </Link>
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 lg:w-[480px]">
              <button type="button" className={BUTTON} disabled={busy} onClick={() => save({ analytics: true, marketing: true })}>
                Приемам всички
              </button>
              <button type="button" className={BUTTON} disabled={busy} onClick={() => save({ analytics: false, marketing: false })}>
                Отказвам
              </button>
              <button type="button" className={BUTTON} disabled={busy} onClick={showSettings}>
                Настройки
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h2 id={headingId} ref={headingRef} tabIndex={-1} className="pt-2 text-[17px] font-extrabold focus:outline-none">
                Настройки за бисквитки
              </h2>
              {reopened ? (
                <button
                  type="button"
                  onClick={close}
                  aria-label="Затвори настройките за бисквитки"
                  className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-blush-100"
                >
                  <IconClose size={22} />
                </button>
              ) : null}
            </div>
            <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
              {CATEGORIES.map((c) => {
                const id = `${uid}-${c.key}`;
                const necessary = c.key === "necessary";
                return (
                  <li key={c.key} className="flex items-start gap-3 px-3.5 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <label htmlFor={id} className="font-bold text-ink">
                        {c.title}
                        {necessary ? <span className="font-semibold text-muted"> · винаги включени</span> : null}
                      </label>
                      <p id={`${id}-text`} className="text-[15px] leading-snug text-ink-2">
                        {c.text}
                      </p>
                    </div>
                    <input
                      id={id}
                      type="checkbox"
                      aria-describedby={`${id}-text`}
                      className="mt-0.5 h-6 w-6 shrink-0 accent-ink disabled:opacity-60"
                      checked={necessary ? true : choice[c.key as keyof Choice]}
                      disabled={necessary || busy}
                      onChange={(e) => {
                        if (necessary) return;
                        const key = c.key as keyof Choice;
                        setChoice((v) => ({ ...v, [key]: e.target.checked }));
                      }}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted">
              Можеш да промениш избора си по всяко време от „Настройки за бисквитки“ в долната част на сайта.{" "}
              <Link href="/biskvitki" className="link text-ink">
                Списък на бисквитките
              </Link>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={BUTTON} disabled={busy} onClick={back}>
                {reopened ? "Затвори" : "Назад"}
              </button>
              <button type="button" className={BUTTON} disabled={busy} onClick={() => save(choice)}>
                Запази избора
              </button>
            </div>
          </div>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-[15px] font-semibold text-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
