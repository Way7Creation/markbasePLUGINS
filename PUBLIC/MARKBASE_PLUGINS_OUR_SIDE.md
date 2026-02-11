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

## 3. Сводка

| Что настраивает внешний проект | Где |
|-------------------------------|-----|
| CSP: `connect-src` для auth и captcha | Nginx / helmet / meta-тег внешнего проекта |
| `credentials: 'include'` при запросах к UAM/Captcha | Frontend внешнего проекта (fetch/axios) |
| Backend: URL для валидации сессии | Код backend внешнего проекта (`https://auth.markbase.ru`) |

| Что настраивается в ядре (waysen_core) | Где |
|---------------------------------------|-----|
| CORS для сторонних доменов (UAM) | `UAM_CORS_ORIGINS` в `.env` (капча разрешает все origins автоматически) |
| Return URL allowlist | `UAM_RETURN_URL_ALLOWLIST` в `.env` |

Типичные проблемы интеграции: [ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md](../../ПРОБЛЕМЫ_НЕ_НА_НАШЕЙ_СТОРОНЕ.md).
