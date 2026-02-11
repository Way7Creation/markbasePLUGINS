# MarkBase — API-плагины

Документация по подключению к API модулей платформы MarkBase.

---

## Модули

| Модуль | Версия | Slug | Описание |
|--------|--------|------|----------|
| [UAM (WaySenID)](./uam/) | 1.5.0 | `uam` | Единая аутентификация, SSO, сессии, проверка email, многоуровневая защита |
| [Captcha](./captcha/) | 1.1.0 | `captcha` | Защита форм от ботов, Яндекс SmartCaptcha, fail-open стратегия |
| [Registry](./registry/) | 1.0.0 | `registry` | Каталог модулей, API-ключи, HMAC |
| [Security](./security/) | 1.1.0 | `security` | Rate limiting, IP-фильтрация, аудит |
| [Monitoring](./monitoring/) | 1.0.0 | `monitoring` | Health checks, метрики, алерты |
| [Billing](./billing/) | 1.0.0 | `billing` | Тарифы, подписки, лимиты |
| [Wallet](./wallet/) | 1.0.0 | `wallet` | Балансы, транзакции, платежи |
| [Docker Performance](./docker-performance/) | 1.0.0 | `docker-performance` | Оптимизация Docker-сборки React/Node.js |

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

Все модули ядра работают в одном Docker-стеке (`waysen_core`). Внешние проекты (app.markbase.ru, shop, сторонние сайты) подключаются через **публичные URL**.

| Модуль | URL для внешних проектов | URL внутри ядра (Docker) |
|--------|--------------------------|--------------------------|
| UAM | `https://auth.markbase.ru` | `http://uam:8060` |
| Captcha | `https://captcha.markbase.ru` | `http://captcha:8079` |
| Registry | `https://registry.markbase.ru` | `http://registry:8065` |
| Wallet | `https://wallet.markbase.ru` | `http://wallet:8070` |
| Billing | `https://billing.markbase.ru` | `http://billing:8069` |

Docker-имена (`http://uam:8060`) работают **только** внутри стека `waysen_core`. Из внешних Docker-стеков или серверов — только публичные URL!

Что настроить на стороне внешнего проекта (CSP, credentials, return_url) — [MARKBASE_PLUGINS_OUR_SIDE.md](../MARKBASE_PLUGINS_OUR_SIDE.md).

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
  -d '{"project_id":"YOUR_UUID","module_slug":"wallet"}'

# 2. Используйте ключ для запросов
curl https://wallet.markbase.ru/api/wallet/v1/balance?project_id=YOUR_UUID \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC"
```

---

## Поддерживаемые платформы

- **JavaScript / Node.js** — npm пакет (планируется)
- **Python** — pip пакет (планируется)
- **PHP / WordPress** — WP-плагин (в каждом модуле есть пример)
- **REST API** — любая платформа через HTTP
