# MarkBase — Документация для разработчиков

Добро пожаловать в документацию платформы **MarkBase**. Здесь вы найдёте всё необходимое для интеграции наших сервисов в ваш проект.

---

## Что здесь есть

### 1. WaySenID — Авторизация через MarkBase

Подключите кнопку **«Войти через WaySenID»** на свой сайт — аналог «Войти через Google/Яндекс» для экосистемы MarkBase.

| Файл | Описание |
|------|----------|
| [auth-widget/README.md](./auth-widget/README.md) | Обзор, кнопка, OAuth 2.0 endpoints, SDK, дизайн-гайд |
| [auth-widget/INTEGRATION.md](./auth-widget/INTEGRATION.md) | Полное руководство: lifecycle, backend-код, схема БД |
| [auth-widget/ONETAP.md](./auth-widget/ONETAP.md) | One Tap — автоматическое предложение входа |
| [auth-widget/waysenid.css](./auth-widget/waysenid.css) | Готовые CSS-стили для кнопки, формы и One Tap |
| [auth-widget/plugin.json](./auth-widget/plugin.json) | Метаданные спецификации |

**Быстрый старт:**

```html
<!-- 1. Подключить SDK -->
<link rel="stylesheet" href="https://auth.markbase.ru/sdk/waysenid.css">
<script src="https://auth.markbase.ru/sdk/waysenid.js"></script>

<!-- 2. Контейнер для кнопки -->
<div id="wsid-button"></div>

<!-- 3. Инициализировать -->
<script>
  WaySenID.init({
    client_id: 'YOUR_CLIENT_ID',
    redirect_uri: window.location.origin + '/auth/callback',
    scope: 'openid profile email'
  });

  WaySenID.renderButton('#wsid-button', {
    variant: 'primary',
    size: 'lg',
    width: '100%'
  });
</script>
```

> Подробнее: [auth-widget/README.md](./auth-widget/README.md)

**Единый вход во всех модулях markbase.ru (app, shop, delivery и т.д.):** только кнопка «Войти через WaySenID», открытие auth в popup, без своих форм входа/регистрации и капчи. Все настройки капчи — в панели captcha.markbase.ru.
→ [MARKBASE_MODULES_AUTH.md](./MARKBASE_MODULES_AUTH.md)

**Проекты с собственной регистрацией («Войти как»):** добавить кнопку «Войти через WaySenID» рядом с «Войти через Google» / «Яндекс» — один модуль, корректная передача данных (cookie на \*.markbase.ru или wsid_code + exchange-code на стороннем домене).
→ [WAYSENID_LOGIN_AS.md](./WAYSENID_LOGIN_AS.md)

---

### 2. API-плагины модулей

Документация по подключению к API модулей MarkBase.

| Модуль | Версия | Описание |
|--------|--------|----------|
| [UAM (WaySenID)](./plugins/uam/) | 1.4.0 | Аутентификация, SSO, сессии, проверка email |
| [Captcha](./plugins/captcha/) | 1.1.0 | Защита форм, Яндекс SmartCaptcha, fail-open |
| [Registry](./plugins/registry/) | 1.0.0 | Каталог модулей, API-ключи, HMAC |
| [Security](./plugins/security/) | 1.1.0 | Rate limiting, IP-фильтрация, аудит |
| [Monitoring](./plugins/monitoring/) | 1.0.0 | Health checks, метрики, алерты |
| [Billing](./plugins/billing/) | 1.0.0 | Тарифы, подписки, лимиты |
| [Wallet](./plugins/wallet/) | 1.0.0 | Балансы, транзакции, платежи |
| [Docker Performance](./plugins/docker-performance/) | 1.0.0 | Оптимизация Docker-сборки |

> Подробнее: [plugins/README.md](./plugins/README.md)

---

## Принципы

1. **OAuth 2.0 + OIDC** — стандартный протокол авторизации
2. **PKCE** — обязательная защита для SPA-приложений
3. **Cookie-based SSO** — единая сессия на `.markbase.ru`
4. **HMAC-подпись** — межмодульные запросы подписываются HMAC-SHA256
5. **API Namespace** — `/api/<slug>/v1/*`
6. **Семантическое версионирование** — major.minor.patch

---

## Единое меню аккаунта (UI стандарт)

Для всех проектов экосистемы (`markbase.ru`, `markbaseCORE`, плагины) выпадающее меню аккаунта в правом верхнем углу должно быть единообразным:

- Профиль пользователя (имя + email)
- Баланс кошелька (из `https://billing.markbase.ru/api/billing/balance`)
- `Аккаунт и безопасность` (`https://auth.markbase.ru/account`) — **метка `внешняя`**
- `Центр уведомлений` (`https://notifications.markbase.ru`) — **метка `внешняя`**
- `Кошелек и платежи` (`https://wallet.markbase.ru`) — **метка `внешняя`**
- `Тарифы и биллинг` (`https://billing.markbase.ru`) — **метка `внешняя`**
- Выход

Если ссылка ведёт на другой поддомен — обязательна метка `внешняя`, чтобы пользователь не путался при переходах.

---

## Безопасность

Все модули MarkBase включают встроенную многоуровневую защиту:

| Модуль защиты | Описание |
|---------------|----------|
| Brute-Force Protection | Макс. 10 попыток / 30 мин, блокировка IP |
| Global Rate Limiter | 120 запросов/мин с одного IP |
| Auth Rate Limiter | 20 запросов/мин на авторизацию |
| IP Auto-Block | Авто-блокировка при 3x превышении лимита |
| HTTPS Enforcement | Принудительное HTTPS + HSTS |
| Password Policy | Мин. 8 символов, A-Z + a-z + 0-9 |
| Captcha | Яндекс SmartCaptcha на регистрации/входе |

---

## Поддерживаемые платформы

- **JavaScript / Node.js** — npm: `@markbase/waysenid-sdk`
- **Python / FastAPI** — примеры в [INTEGRATION.md](./auth-widget/INTEGRATION.md)
- **PHP / WordPress** — примеры в каждом плагине
- **REST API** — любая платформа через HTTP

---

## Быстрый старт (API)

```bash
# 1. Получите API-ключ через Registry
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -d '{"project_id":"YOUR_UUID","module_slug":"wallet"}'

# 2. Используйте ключ для запросов
curl https://wallet.markbase.ru/api/wallet/v1/balance?project_id=YOUR_UUID \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC"
```

---

## Changelog

### 2026-02-09 (v5)
- Реорганизация документации: разделение на PUBLIC и MARKBASE
- Auth Widget v3.0.0 — One Tap, внешние провайдеры, Developer Dashboard

### 2026-02-09 (v4)
- Auth Widget v2.0.0 — Полное руководство интеграции, примеры WayGPT

### 2026-02-09 (v3)
- Footer — 3 типа подвалов (AppFooter, PublicFooter, AuthFooter)

### 2026-02-20 (v2.1)
- Header v1.1.0 — унифицированный dropdown аккаунта (баланс кошелька + внешние ссылки с меткой `внешняя`)

### 2026-02-09 (v2)
- Header v1.0.0, Sidebar v1.0.0 — Единый дизайн для CORE модулей

### 2026-02-09 (v1)
- UAM v1.4.0, Captcha v1.1.0, Docker Performance v1.0.0

### 2026-02-08
- UAM v1.3.0, Security v1.1.0, Captcha v1.0.0

### 2026-02-07
- Первый релиз (UAM 1.2.0, Security 1.0.0, Registry 1.0.0, Monitoring 1.0.0, Billing 1.0.0, Wallet 1.0.0)

---

*markbase.ru — Документация для разработчиков*
