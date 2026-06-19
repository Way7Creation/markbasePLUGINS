# SERVICES — интеграция внешнего сайта (C-контур)

Эталон реализации: **студия «Дыхание»** — `PROJET_COMMERCE/studiya-tantsev/sitedev/`.

## Контуры

| Контур | URL | Роль |
|--------|-----|------|
| Markbase PROD | `https://app.markbase.ru`, `https://services.markbase.ru` | SSOT расписания, виджеты, брони, CRM |
| Сайт клиента (local) | `http://localhost:3000` | Публичный UI + embed host |
| SHOP vitrina | `shop_id` в HANDOFF | Связка заказов/клиентов (опц.) |

**Не поднимать** локальный docker Markbase для настройки — только PROD UI.

## Минимальная цепочка

```
Контент/SEO сайта
  → Widget Studio (group_classes + trial tokens)
  → settings/env сайта (widget_token_*)
  → BookingEmbedHost (/raspisanie, /probnoe-zanyatie)
  → PROD SERVICES API (enroll/book)
  → CRM client + booking
  → ЛК ученика (фаза vdoh-sync-bridge)
```

## Env сайта (sitedev)

```env
VDOH_SERVICES_API_BASE=https://services.markbase.ru/api/services/v1
VDOH_SERVICES_WIDGET_TOKEN_GROUP=<token group_classes>
VDOH_SERVICES_WIDGET_TOKEN_TRIAL=<token trial>
VDOH_SERVICES_EMBED_ENABLED=true
```

Секреты — только в `.env.local` / credentials (gitignored). Плейсхолдеры — `.env.example`.

## Embed host (Next.js)

| Файл | Назначение |
|------|------------|
| `src/server/services/embed.ts` | `resolveWidgetEmbedUrl`, readiness helpers |
| `src/widgets/booking/BookingEmbedHost.tsx` | iframe + skeleton + error fallback |
| `app/(public)/raspisanie/page.tsx` | group embed primary; ScheduleView readOnly fallback |
| `app/(public)/probnoe-zanyatie/page.tsx` | trial embed + LeadForm fallback |
| `app/api/embed/services/[token]/route.ts` | Local proxy shell (CSP/CORS bypass) |
| `app/api/services-bridge/[...path]/route.ts` | Server proxy API + ESM assets |

Seed токенов в local DB: `npm run seed:embed` (из HANDOFF placeholders).

## SHOP bridge (опционально)

Для витрины Markbase SHOP — `GroupClassGrid` и server enroll через shop bridge (`class-session.service.js` → `enrollClassSessionFromShopBridge`).

Внешний сайт без SHOP использует **widget token API** напрямую (через proxy при localhost).

## Операторские проверки (PROD)

1. SA → switch **ИП / КОММЕРЦИЯ** (не ООО платформы).
2. `app.markbase.ru/modules/services` — `company_id` tenant в footer API hint.
3. `services.markbase.ru/bookings?tab=my_specialist` — записи ко специалисту.
4. `services.markbase.ru/bookings?tab=group_classes` — групповые занятия.

Если API возвращает `402 MODULE_DISABLED` — выполнить на сервере:

```bash
sudo bash scripts/deployment/ensure-billing-modules-active.sh
```

## Registry / HMAC (межмодульно)

Для server-to-server (не embed): `SERVICES_API_KEY`, `SERVICES_HMAC_SECRET` из Registry; заголовки `X-Api-Key`, `X-Timestamp`, `X-Signature`, `X-Company-Id`.

## Документация модуля

- `markbase.ru/modouls/SERVICES/` — backend/frontend/migrations
- `PROJECT_DOCS/VDOH_SERVICES_WIDGET_2026/` — журнал E2E (VDOH)
- `Plugins/PUBLIC/plugins/services/plugin.json` — machine-readable контракт

## Track A

Контракт **A8** (embed-ready domain modules): SERVICES plugin + widget docs — см. `PROJET_COMMERCE/001_EDINAYA_SISTEMA_RAZRABOTKI/TRACK_A_STATUS.md`.
