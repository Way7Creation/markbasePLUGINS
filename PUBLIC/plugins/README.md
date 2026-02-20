# MarkBase — API-плагины

Документация по подключению к API модулей платформы MarkBase.

---

## Модули

### Ядро (Core)

| Модуль | Версия | Slug | Порт | Домен | Описание |
|--------|--------|------|------|-------|----------|
| [UAM (WaySenID)](./uam/) | 1.5.0 | `uam` | 8060 | `auth.markbase.ru` | Единая аутентификация, SSO, сессии, проверка email, многоуровневая защита |
| [Captcha](./captcha/) | 1.1.0 | `captcha` | 8079 | `captcha.markbase.ru` | Защита форм от ботов, Яндекс SmartCaptcha, fail-open стратегия |
| [Registry](./registry/) | 1.1.0 | `registry` | 8065 | `registry.markbase.ru` | Каталог модулей, API-ключи, HMAC |
| [Security](./security/) | 1.1.0 | `security` | 8061 | `security.markbase.ru` | Rate limiting, IP-фильтрация, аудит |
| [Monitoring](./monitoring/) | 1.0.0 | `monitoring` | 8063 | `monitoring.markbase.ru` | Health checks, метрики, алерты |
| [Billing](./billing/) | 1.0.0 | `billing` | 8069 | `billing.markbase.ru` | Тарифы, подписки, лимиты |
| [Wallet](./wallet/) | 1.0.0 | `wallet` | 8070 | `wallet.markbase.ru` | Балансы, транзакции, платежи |
| [Docker Performance](./docker-performance/) | 1.0.0 | `docker-performance` | — | — | Оптимизация Docker-сборки React/Node.js |

### Бизнес-модули

| Модуль | Версия | Slug | Порт | Домен | Описание |
|--------|--------|------|------|-------|----------|
| [CRM](./crm/) | 1.0.0 | `crm` | 8067 | `crm.markbase.ru` | Управление клиентами, менеджерами, заказами, активностями |
| [HRM](./hrm/) | 1.0.0 | `hrm` | 8068 | `hrm.markbase.ru` | Управление сотрудниками, отделами, должностями |
| [Orders](./orders/) | 1.0.0 | `orders` | 8085 | `orders.markbase.ru` | Закупки у поставщиков (RS24, ETM), спецификации |
| [Shop](./shop/) | 1.0.2 | `shop` | 8020 | `shop.markbase.ru` | Интернет-магазин: каталог, корзина, B2B/B2C чекаут, AI-поиск |

### Файлы и хранение

| Модуль | Версия | Slug | Порт | Домен | Описание |
|--------|--------|------|------|-------|----------|
| [Files](./files/) | 1.0.0 | `files` | 8095 | `files.markbase.ru` | Загрузка, хранение, обработка файлов (изображения, документы) |

### Логистика

| Модуль | Версия | Slug | Порт | Домен | Описание |
|--------|--------|------|------|-------|----------|
| [Delivery](./delivery/) | 1.0.0 | `delivery` | 8080 | `delivery.markbase.ru` | Доставка: CDEK, Деловые Линии, ПЭК, тарифы, ПВЗ |
| [Logistics](./logistics/) | 1.0.0 | `logistics` | 8090 | `logistics.markbase.ru` | Заказы, отправления, возвраты, QR-коды выдачи |

---

## Авторизация через WaySenID

Для подключения кнопки **«Войти через WaySenID»** — см. [auth-widget/](../auth-widget/).

---

## Принципы

1. **Единый вход** — все модули используют UAM (WaySenID) для аутентификации
2. **Cookie-based SSO** — `uam_session` на домене `.markbase.ru`
3. **HMAC-подпись** — межмодульные запросы подписываются HMAC-SHA256
4. **API Namespace** — `/api/<slug>/v1/*`
5. **Версионирование** — семантическое (major.minor.patch)
6. **Отказоустойчивость** — кэш сессий UAM на каждом модуле
7. **Мультитенантность** — полная изоляция данных по `shop_id` / `company_id`

## UI-стандарт для аккаунт-меню (обязательно для модулей с web UI)

Если модуль имеет интерфейс с профилем пользователя в шапке, используется единый dropdown:

- Профиль (имя + email)
- Баланс кошелька (`billing.markbase.ru/api/billing/balance`)
- Ссылки:
  - `Аккаунт и безопасность` (`auth.markbase.ru`)
  - `Центр уведомлений` (`notifications.markbase.ru`)
  - `Кошелек и платежи` (`wallet.markbase.ru`)
  - `Тарифы и биллинг` (`billing.markbase.ru`)
  - `Помощь и документация` (`help.markbase.ru`)
  - `Выйти`

Любая ссылка на другой поддомен отмечается меткой `внешняя`.

Источник спецификации: `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER.md` (`header.json`).

---

## Мультитенантная изоляция

Каждый бизнес-модуль обеспечивает **полную изоляцию данных** между клиентами:

| Уровень изоляции | Механизм | Описание |
|-----------------|----------|----------|
| Данные | `shop_id` / `company_id` | Все таблицы содержат идентификатор владельца |
| SQL-запросы | `WHERE shop_id = $1` | Каждый запрос фильтруется по владельцу |
| Индексы | `CREATE INDEX ... ON (shop_id)` | Быстрая выборка в рамках одного клиента |
| API-ключи | Per-shop/per-company | Отдельные ключи для каждого проекта |
| HMAC-секреты | Per-connection | Уникальные секреты для каждого подключения |
| Rate Limiting | Per-shop | Лимиты запросов применяются для каждого магазина |

**Гарантия**: Данные клиента A никогда не доступны клиенту B. Ни через API, ни через admin-панель, ни через прямые запросы к БД.

---

## Безопасность

| Модуль защиты | Описание | Статус |
|---------------|----------|--------|
| Brute-Force Protection | Макс. 10 попыток / 30 мин, прогрессивная блокировка IP | Активна |
| Global Rate Limiter | 120 запросов/мин с одного IP на все API-маршруты | Активна |
| Auth Rate Limiter | 20 запросов/мин на авторизационные эндпоинты | Активна |
| IP Auto-Block | Автоматическая блокировка IP при 3x превышении лимита | Активна |
| HTTPS Enforcement | Принудительное HTTPS + HSTS заголовки | Активна |
| Password Policy | Минимум 8 символов, заглавные + строчные + цифры | Активна |
| Captcha Protection | Яндекс SmartCaptcha на регистрации/входе | Активна |
| Data Isolation | Полная изоляция данных по shop_id/company_id | Активна |
| HMAC Verification | Все межмодульные запросы подписаны HMAC-SHA256 | Активна |

---

## Отказоустойчивость

Все модули кэшируют результат валидации сессии UAM **локально**:

| Ситуация | Поведение |
|----------|-----------|
| UAM доступен | Кэш обновляется каждые 60 сек |
| UAM недоступен | Кэш работает до 72 часов — пользователи НЕ вылетают |
| Пользователь нажал «выйти везде» | Кэш удаляется (`reason: "revoked"`) |

Подробнее: [UAM Plugin → Отказоустойчивость](./uam/README.md#отказоустойчивость-graceful-degradation)

---

## Подключение из внешних проектов

Модули работают в **двух Docker-стеках** на разных серверах. Внешние проекты подключаются через **публичные URL**.

**Сервер 1 — waysen_core (ядро):**

| Модуль | Публичный URL | Docker-имя (внутри waysen_core) |
|--------|---------------|--------------------------------|
| UAM | `https://auth.markbase.ru` | `http://uam:8060` |
| Captcha | `https://captcha.markbase.ru` | `http://captcha:8079` |
| Registry | `https://registry.markbase.ru` | `http://registry:8065` |
| Security | `https://security.markbase.ru` | `http://security:8061` |
| Monitoring | `https://monitoring.markbase.ru` | `http://monitoring:8063` |
| Billing | `https://billing.markbase.ru` | `http://billing:8069` |
| Wallet | `https://wallet.markbase.ru` | `http://wallet:8070` |

**Сервер 2 — markbase.ru (коммерческие модули):**

| Модуль | Публичный URL | Docker-имя (внутри markbaseru) |
|--------|---------------|-------------------------------|
| Shop | `https://shop.markbase.ru` | `http://shop-backend:8020` |
| Orders | `https://orders.markbase.ru` | `http://orders-backend:8085` |
| CRM | `https://crm.markbase.ru` | `http://crm-backend:8067` |
| HRM | `https://hrm.markbase.ru` | `http://hrm-backend:8068` |
| Delivery | `https://delivery.markbase.ru` | `http://delivery-backend:8080` |
| Logistics | `https://logistics.markbase.ru` | `http://logistics-backend:8090` |
| Files | `https://files.markbase.ru` | `http://files-backend:8095` |

Docker-имена работают **только** внутри своего стека. Между серверами — только через публичные HTTPS URL!

Что настроить на стороне внешнего проекта (CSP, credentials, return_url) — [MARKBASE_PLUGINS_OUR_SIDE.md](../MARKBASE_PLUGINS_OUR_SIDE.md).

---

## Схема взаимодействия модулей

```
                  ┌──────────────────┐
                  │   UAM (WaySenID) │     ┌──────────┐
                  │  auth.markbase.ru│     │ Registry │
                  └────────┬─────────┘     │ API-ключи│
                           │ SSO / Session └────┬─────┘
        ┌──────────────────┼─────────────────────┤
        │                  │                     │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │  Shop   │──────▶│ Orders  │       │   CRM   │
   │ Магазин │       │ Закупки │──────▶│ Клиенты │
   └──┬──┬───┘       └────┬────┘       └────▲────┘
      │  │                │                  │
      │  │          ┌─────▼─────┐            │
      │  └─────────▶│ Logistics │────────────┘
      │             │ Логистика │
      │             └─────┬─────┘
      │                   │
      │             ┌─────▼─────┐       ┌─────────┐
      │             │ Delivery  │       │   HRM   │──▶ CRM
      │             │ Доставка  │       │   HR    │
      │             └───────────┘       └─────────┘
      │
      │  ┌──────────┐
      └─▶│  Files   │ ← все модули загружают файлы
         │ Хранение │
         └──────────┘
```

---

## Типичные проблемы: где искать решение

| Проблема | Где правится | Документация |
|----------|-------------|--------------|
| CORS «multiple values» для капчи | В `.env` ядра или Nginx captcha | [ПРОБЛЕМЫ](../../../ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md) § 1.1 |
| Капча недоступна / таймаут | Контейнер captcha в waysen_core | [ПРОБЛЕМЫ](../../../ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md) § 1.2 |
| CORS / «Network Error» при входе | CSP внешнего проекта или `UAM_CORS_ORIGINS` | [ПРОБЛЕМЫ](../../../ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md) § 2 |
| Return URL отклонён | `UAM_RETURN_URL_ALLOWLIST` в `.env` ядра | [ПРОБЛЕМЫ](../../../ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md) § 2.3 |
| ReferenceError в main.*.js | Фронтенд внешнего проекта | [ПРОБЛЕМЫ](../../../ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md) § 3 |

---

## Быстрый старт

```bash
# 1. Получите API-ключ через Registry
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -d '{"project_id":"YOUR_UUID","module_slug":"shop"}'

# 2. Используйте ключ для запросов
curl https://shop.markbase.ru/api/shop/v1/catalog?shop_id=YOUR_SHOP_ID \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Shop-Id: YOUR_SHOP_ID"
```

---

## Управление модулями

Подключённые модули можно просмотреть и управлять ими в личном кабинете:

**[https://auth.markbase.ru/account/modules](https://auth.markbase.ru/account/modules)**

На странице модулей вы можете:
- Просмотреть все доступные модули экосистемы
- Подключить модули к своему проекту
- Настроить API-ключи и HMAC-секреты
- Просмотреть документацию по каждому модулю
- Перейти в admin-панель подключённых модулей

---

## Поддерживаемые платформы

- **JavaScript / Node.js** — npm пакет (планируется)
- **Python** — pip пакет (планируется)
- **PHP / WordPress** — WP-плагин (в каждом модуле есть пример)
- **REST API** — любая платформа через HTTP

---

## UI Compliance (Header v1.1.0)

Если модуль имеет web-интерфейс с аккаунт-меню в правом верхнем углу, обязательно соблюдается единый стандарт экосистемы:

- профиль (имя + email)
- баланс кошелька из `https://billing.markbase.ru/api/billing/balance`
- пункты: аккаунт/безопасность, уведомления, кошелек, тарифы/биллинг, помощь, выход
- переходы на другие поддомены помечаются тегом `внешняя`

Источник стандарта:

- `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER.md`
- `markbaseCORE/INTEGRATION/MARKBASE/design/header.json`
- `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER_CHECKLIST.md`

