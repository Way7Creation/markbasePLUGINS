# Подключение внешних проектов к модулям ядра MarkBase

В этом документе описано, что нужно настроить **на стороне внешнего проекта** (app.markbase.ru, shop.markbase.ru, сторонние сайты клиентов) для корректной работы с модулями ядра платформы.

---

## Архитектура: где что работает

```
┌──────────────────────────────────────────────────────────────┐
│            ЯДРО ПЛАТФОРМЫ (waysen_core docker-compose)         │
│                                                                │
│   core-postgres ──┐                                           │
│   core-redis    ──┤  Общая Docker-сеть: waysen_core_internal  │
│   core-keycloak ──┤                                           │
│                   │                                           │
│   UAM      :8060  │◄── auth.markbase.ru                      │
│   Captcha  :8079  │◄── captcha.markbase.ru                   │
│   Registry :8065  │◄── registry.markbase.ru                  │
│   Security :8061  │◄── security.markbase.ru                  │
│   Monitoring:8063 │◄── monitoring.markbase.ru                │
│   Billing  :8069  │◄── billing.markbase.ru                   │
│   Wallet   :8070  │◄── wallet.markbase.ru                    │
│                   │                                           │
│   Внутри стека модули общаются по Docker-именам:             │
│   http://uam:8060, http://captcha:8079 и т.д.               │
└──────────────────────────────────────────────────────────────┘
          ▲                    ▲                    ▲
          │ HTTPS              │ HTTPS              │ HTTPS
          │                    │                    │
┌─────────┴──────┐  ┌─────────┴──────┐  ┌─────────┴──────┐
│ app.markbase.ru│  │shop.markbase.ru│  │ yoursite.com   │
│ (другой Docker)│  │(другой Docker) │  │(другой сервер) │
│                │  │                │  │                │
│ waysen-commerce│  │ waysen-commerce│  │ Сайт клиента   │
└────────────────┘  └────────────────┘  └────────────────┘

Внешние проекты подключаются ТОЛЬКО через публичные URL:
  https://auth.markbase.ru    — авторизация (UAM)
  https://captcha.markbase.ru — капча
  https://registry.markbase.ru — API-ключи
```

---

## 1. UAM (auth.markbase.ru) — Авторизация

### 1.1 CSP (Content-Security-Policy)

Если ваш проект использует CSP, добавьте auth.markbase.ru и captcha.markbase.ru:

```
connect-src 'self' https://auth.markbase.ru https://captcha.markbase.ru ...;
script-src 'self' https://captcha.markbase.ru https://smartcaptcha.yandexcloud.net ...;
frame-src https://smartcaptcha.yandexcloud.net ...;
```

Без этого браузер заблокирует запросы к UAM API — «Network Error» при входе.

Полный справочник: [CSP_AND_SECURITY.md](./CSP_AND_SECURITY.md).

### 1.2 Запросы с credentials

Все запросы к UAM API из браузера — с `credentials: 'include'` (или `withCredentials: true`), иначе cookie `uam_session` не отправляется:

```javascript
fetch('https://auth.markbase.ru/api/uam/v1/me', { credentials: 'include' });
```

### 1.3 CORS на стороне UAM

UAM уже разрешает CORS для `*.markbase.ru` и `*.waygpt.ru` автоматически. Для сторонних доменов добавьте их в `UAM_CORS_ORIGINS` в `.env` ядра.

### 1.4 Return URL

При редиректе на `auth.markbase.ru/login?return_url=...` домен из `return_url` должен быть в `UAM_RETURN_URL_ALLOWLIST` (по умолчанию `.markbase.ru,.waygpt.ru`). Для сторонних доменов — добавьте в allowlist.

### 1.5 Валидация сессии на backend

Ваш backend вызывает `GET /api/uam/v1/session/validate` с cookie пользователя.

| Откуда вызываете | URL для UAM |
|------------------|-------------|
| Из модуля ядра (waysen_core стек) | `http://uam:8060` (Docker-имя) |
| Из внешнего проекта (другой Docker/сервер) | `https://auth.markbase.ru` (публичный URL) |

Docker-имена (`http://uam:8060`) работают **только** внутри одного docker-compose стека!

---

## 2. Captcha (captcha.markbase.ru) — Защита форм

### 2.1 CORS

Капча автоматически разрешает CORS для **всех origins** — виджет предназначен для встраивания на любой сайт (как reCAPTCHA / hCaptcha). Никаких дополнительных настроек CORS не требуется.

Валидация домена происходит на уровне **проекта** в БД (поле `allowed_domains`). При создании проекта через админ-панель указываются допустимые домены.

CORS-заголовки ставит **только Express** (middleware). Nginx captcha.markbase.ru **НЕ** добавляет CORS-заголовки — иначе получится двойной `Access-Control-Allow-Origin` и браузер его отвергнет.

### 2.2 Виджет

Для встраивания на внешний сайт:

```html
<script src="https://captcha.markbase.ru/widget.js"></script>
```

В CSP внешнего проекта:
- `script-src`: `https://captcha.markbase.ru`
- `connect-src`: `https://captcha.markbase.ru`

---

## 3. Граница ответственности: клиент vs Markbase

Ключевой принцип контура C (плагин на чужом сайте): **данные сайта и пользователей остаются в БД клиента**, Markbase предоставляет только сервисы по API. Клиент сам кладёт данные в **свои таблицы** так, как ему нужно (в WordPress, своей CMS, своём backend).

| Зона | На стороне клиента (его сервер / его БД) | На стороне Markbase |
|------|------------------------------------------|---------------------|
| Пользователи сайта | **своя таблица users** (+ `wsid_user_id`/`oauth_tokens` для связи), своя сессия, callback-route | хранение аккаунта Марбэйс id, пароли, подтверждение email, капча регистрации |
| Контент/товары на чужом сайте | свои таблицы (posts, products) в WP/CMS клиента | только API-ответы модулей (catalog, seo, services) |
| Секреты подключения | `.env` клиента: `*_API_KEY`, `*_URL`, HMAC-секрет | выдача ключей через Registry, проверка HMAC |
| Безопасность фронта | CSP, `credentials: 'include'`, CORS своего домена | rate-limit, Security, billing/402, CORS allowlist ядра |
| Согласия/ПДн на формах | UI согласий и хранение по 152-ФЗ в БД клиента | consent SSOT только для аккаунта Марбэйс id |

> **152-ФЗ:** формы регистрации/обратной связи на сайте клиента — зона ответственности клиента (юр. тексты, cookie-баннер, хранение согласий). Канон платформы: каталог `152ФЗ/` + правило `.cursor/rules/personal-data-152fz-compliance.mdc`. Марбэйс id отвечает только за согласия внутри своего аккаунта.

---

## 4. Единый клиентский `.env` (шаблон-обёртка)

Один файл на стороне клиентского сайта. Имена `MARKBASE_*` — унифицированный шаблон; машинный SSOT имён — `config` в `plugin.json` каждого модуля (`SHOP_URL`, `CAPTCHA_URL`, …). Включайте только нужные модули.

```bash
# === Markbase: общее ===
MARKBASE_REGISTRY_URL=https://registry.markbase.ru
MARKBASE_COMPANY_ID=        # юрлицо/биллинг
MARKBASE_SHOP_ID=           # витрина (если используется SHOP)
MARKBASE_SITE_ID=           # внешний сайт (plugin-контур)

# === Auth (Марбэйс id) ===
MARKBASE_AUTH_URL=https://auth.markbase.ru
MARKBASE_AUTH_CLIENT_ID=    # для OAuth-варианта (auth-widget)

# === Captcha ===
MARKBASE_CAPTCHA_URL=https://captcha.markbase.ru
MARKBASE_CAPTCHA_SITE_KEY=
MARKBASE_CAPTCHA_SECRET_KEY=REPLACE_WITH_STRONG_SECRET

# === Любой модуль (пример: shop) ===
MARKBASE_SHOP_URL=https://shop.markbase.ru
MARKBASE_SHOP_API_KEY=REPLACE_WITH_STRONG_48_CHAR_API_KEY
MARKBASE_SHOP_HMAC_SECRET=REPLACE_WITH_STRONG_SECRET
```

Правила: пустой обязательный ключ → ошибка старта (fail-closed); только публичные HTTPS URL (не `http://uam:8060` с чужого VPS); секреты — только на сервере клиента, не в git.

> **SHOP на чужом домене — только headless.** Cookie-SSO `uam_session` на `.markbase.ru` **не работает** на `yoursite.com`. Поэтому корзина/чекаут/аккаунт SHOP на чужом домене подключаются в **headless-режиме** (REST + HMAC из backend клиента или Марбэйс id OAuth для пользователя), а не через cookie витрины markbase. Полноценная витрина с cookie-SSO — это контур A (`*.shop.markbase.ru`) или B (Box).

---

## 5. Сводка настроек

| Что настраивает внешний проект | Где |
|-------------------------------|-----|
| CSP: `connect-src` для auth и captcha | Nginx / helmet / meta-тег внешнего проекта |
| `credentials: 'include'` при запросах к UAM/Captcha | Frontend внешнего проекта (fetch/axios) |
| Backend: URL для валидации сессии | Код backend внешнего проекта (`https://auth.markbase.ru`) |
| Своя таблица пользователей + связь с Марбэйс id | БД клиента |
| `.env` с ключами модулей | Сервер клиента |

| Что настраивается в ядре (waysen_core) | Где |
|---------------------------------------|-----|
| CORS для сторонних доменов (UAM) | `UAM_CORS_ORIGINS` в `.env` (капча разрешает все origins автоматически) |
| Return URL allowlist | `UAM_RETURN_URL_ALLOWLIST` в `.env` |

Типичные проблемы интеграции и их решения собраны в этом же документе (разделы выше) и в каталоге [plugins/README.md](./plugins/README.md) § «Типичные проблемы».
