# ADR 0001 — Стек и какво е взето от Reducta (Фаза 0)

Дата: 03.11.2026 · Статус: прието

## Контекст

Хостингът в Superhosting изтича на **12.11.2026**. Новият магазин трябва да е на живо преди това (PROMPT §19.1). За да стане бързо и предвидимо, базата е кодът на `logiqmodern/reducta-new` (Лежиш и Отслабваш), който е на живо от 27.10.2026.

## Решения

| Тема | Решение | Защо |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Cache Components), React 19, TypeScript strict | Като Reducta; един човек поддържа и двата проекта |
| База | Postgres + Drizzle 0.45, миграции в `src/db/migrations` (нова история от `0000_init`) | SQL-близко; резервацията на уникат (§5.3) иска `FOR UPDATE` и частичен уникален индекс |
| Хостинг | **Vercel (Pro) + Neon Postgres** (решение на клиента, 03.11.2026). VPS е по-късно | Бърз старт без сървърна работа. Hobby е само за некомерсиална употреба → Pro |
| Фонови задачи | На Vercel: cron routes (`/api/cron/*`). `src/worker` (pg-boss) остава за VPS | Vercel няма дълго живеещи процеси |
| Админ auth | Собствена сесия (argon2id) + TOTP 2FA, **задължителна за двете роли** | Взето от Reducta, тествано |
| Роли | `owner` (клиентът), `developer` (Тони). Ролята `staff` е махната | Няма служители |
| Email | Resend + React Email, outbox таблица с повторни опити | Взето от Reducta; шаблоните за поръчки — Фаза 1/6 |
| Изображения | В базата (bytea, WebP ≤ 2400 px), сервират се от `/media/[id]` | Покрити от бекъпа на базата; работят на всеки хост |
| npm | 11 | lockfile-ът е от npm 11 (ADR 0001 на Reducta, т. 5) |

## Взето от Reducta (копирано и адаптирано)

- Инфраструктура: `next.config.ts`, `src/proxy.ts` (CSP с nonce за админа и checkout-а), `src/lib/env.ts`, `src/lib/security-headers.ts`, rate limit, Turnstile, CI (`.github/workflows/ci.yml`), `Dockerfile`/`compose*.yaml` (за VPS по-късно).
- Админ: вход, 2FA, покани за потребители, одит лог, медия библиотека, UI компоненти, навигация, запитвания.
- Email: outbox, доставка, Resend транспорт и webhook, сигнали до Тони.
- Измерване: consent банер, Consent Mode v2, GA4, Meta Pixel + CAPI, UTM атрибуция.

## Махнато (резервационният домейн)

Услуги, слотове, календар, кушетки, пакети, клиенти, плащания на вноски, промокодове, график, CMS блоковете на Лежиш и Отслабваш, всички публични страници, BookingPress импорт, VPS deploy workflows (те пишеха в `/srv/lejish` на общия VPS — опасно за другия проект).

## Ново за Likina

- `src/domain/settings.ts` — правила на магазина (резервация 15 мин, изпращане 2–3 дни, −5% при вземане, доставка „включена“).
- `src/domain/contacts.ts` — контакти и правни данни на продавача (занаятчия, ЕИК 177641226, без ДДС).
- `src/lib/inquiry-fields.ts` — запитвания: икона по поръчка, контакт, подобна творба.
- Навигация на админа: Табло, Творби, Поръчки, Запитвания, Настройки — **един и същ кратък списък за клиента и за Тони** (принцип „интуитивен админ“, PROMPT §10).

## Отложено

| Решение | Фаза |
|---|---|
| i18n структура (BG на `/`, EN на `/en`) | 4 |
| Схема за творби/поръчки, `pricing.ts` за магазина | 1 |
| Шаблони на имейлите за поръчки (BG/EN) | 1/6 |
| Шаблонни пренасочвания от WordPress | 8 |

## Среди (03.11.2026)

| Ресурс | Стойност |
|---|---|
| Vercel | екип „Enjoy Wien“, проект `likina` (`prj_QRmNdcgbOjEShhyKMuaoUjYkHdk1`), Node 22, регион fra1, Vercel Authentication за `*.vercel.app` |
| Neon | организация на Тони, проект `likina` (`wild-sun-72371394`), Postgres 17, aws-eu-central-1, лимит 1 GB на клон (безплатен план) |
| Env на Vercel | `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`, `ADMIN_SETUP_TOKEN` (еднократен), `CRON_SECRET`, `STUDIO_NOTIFY_EMAIL`, `EMAIL_REPLY_TO` |

Снимките са в базата: 327 изображения като WebP ≈ 100–150 MB — в рамките на 1 GB. При растеж: Vercel Blob или платен Neon план.
