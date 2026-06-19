# SERVICES — embed-виджеты (Widget Studio)

Канон кода: `markbase.ru/modouls/SERVICES/frontend/src/widgets/`, `ScheduleManagerWidget.tsx` (вкладка Widget Studio).

## Типы виджетов (`widget_type`)

| Тип | Назначение | Публичный UI |
|-----|------------|--------------|
| `group_classes` | Групповые занятия (class_sessions) | `GroupClassEmbedWidget` |
| `trial` | Пробная запись на фиксированную услугу | `BookingCalendarWidget` (skip service picker) |
| `specialist_slots` | Индивидуальные слоты специалиста | `BookingCalendarWidget` |

## Создание токена (PROD UI)

1. Войти в `https://app.markbase.ru` → контекст **коммерческой компании** (не ООО платформы).
2. `Услуги: календарь и CRM` → `https://services.markbase.ru/bookings?tab=schedule` → вкладка **Виджеты**.
3. Создать виджет: тип, `primary_color`, `allowed_origins`, опционально `shop_id`, `bookableServiceId` (trial).
4. Скопировать **token** (не публиковать в git).

## Встраивание на внешний сайт

### Прямой iframe (production host в allowlist)

```html
<iframe
  src="https://services.markbase.ru/widget/{TOKEN}"
  title="Запись на занятие"
  style="width:100%;min-height:640px;border:0"
  loading="lazy"
></iframe>
```

Требования:

- Домен родителя должен быть в `allowed_origins` виджета.
- CSP `frame-ancestors` на `services.markbase.ru` должен включать домен сайта (nginx `services.markbase.conf`).

### Локальная разработка (localhost)

Если родитель `http://localhost:3000`, а PROD CSP не содержит localhost — используйте **proxy host** (эталон VDOH sitedev):

- Shell: `GET /api/embed/services/{token}` — HTML + fetch-patch
- API/assets: `GET /api/services-bridge/...` → server-side proxy на PROD

См. `PROJET_COMMERCE/studiya-tantsev/sitedev/app/api/embed/services/[token]/route.ts`.

## Публичные API (без сессии)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/services/v1/widget/:token` | Конфиг виджета |
| GET | `/api/services/v1/widget/:token/class-sessions` | Список групповых занятий |
| POST | `/api/services/v1/widget/:token/enroll` | Запись на занятие |

Тело `enroll` (JSON):

```json
{
  "classSessionId": "uuid",
  "clientName": "Имя",
  "clientPhone": "+7...",
  "clientEmail": "email@example.com",
  "privacyConsent": true
}
```

Проверки: `allowed_origins` (Origin), согласие ПДн, свободные места, CRM client create/sync.

## Powered-by

`ServicesPoweredByFooter` — обязательный для публичного embed (тариф/бренд). Отключение — только настройками виджета в Studio, не в коде сайта.

## Ошибки

| Код | Значение |
|-----|----------|
| 402 `MODULE_DISABLED` | Модуль `services` не active в `billing_modules` — operator: `ensure-billing-modules-active.sh` |
| 403 origin | Домен не в `allowed_origins` |
| 404 | Токен не найден или виджет неактивен |
