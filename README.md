# MarkBase CORE — Plugins

Официальные плагины для интеграции модулей MarkBase в ваши проекты.

> Источник единого стандарта для всех проектов:
> `markbaseCORE/INTEGRATION/PLATFORM_BASELINE.md`
> и `markbaseCORE/INTEGRATION/platform-registry.json`.
> Любые изменения по доменам/портам/контрактам сначала вносятся туда.

## Модули

| Plugin | Версия | Slug | Описание |
|--------|--------|------|----------|
| [UAM (WaySenID)](./uam/) | 1.0.0 | `uam` | Единая аутентификация, SSO, сессии |
| [Registry](./registry/) | 1.0.0 | `registry` | Каталог модулей, API-ключи, HMAC |
| [Security](./security/) | 1.0.0 | `security` | Rate limiting, IP-фильтрация, аудит |
| [Monitoring](./monitoring/) | 1.0.0 | `monitoring` | Health checks, метрики, алерты |
| [Billing](./billing/) | 1.0.0 | `billing` | Тарифы, подписки, лимиты |
| [Wallet](./wallet/) | 1.0.0 | `wallet` | Балансы, транзакции, платежи |

## Принципы

1. **Единый вход** — все модули используют UAM (WaySenID) для аутентификации
2. **Cookie-based SSO** — `uam_session` на домене `.markbase.ru`
3. **HMAC-подпись** — межмодульные запросы подписываются HMAC-SHA256
4. **API Namespace** — `/api/<slug>/v1/*`
5. **Версионирование** — семантическое (major.minor.patch)
6. **Отказоустойчивость** — кэш сессий UAM на каждом модуле (пользователи не вылетают при сбое auth)

## Единый стиль аккаунт-меню (обязательный стандарт)

Для всех проектов экосистемы (включая внешние интеграции, где есть меню аккаунта в шапке) применяется единый UX-паттерн dropdown справа сверху:

1. Блок профиля: имя + email пользователя.
2. Баланс кошелька: источник `https://billing.markbase.ru/api/billing/balance`.
3. Пункты меню:
   - `Аккаунт и безопасность` -> `https://auth.markbase.ru/account`
   - `Центр уведомлений` -> `https://notifications.markbase.ru`
   - `Кошелек и платежи` -> `https://wallet.markbase.ru`
   - `Тарифы и биллинг` -> `https://billing.markbase.ru`
   - `Помощь и документация` -> `https://help.markbase.ru`
   - `Выйти`
4. Для всех переходов на другой поддомен обязательна метка `внешняя`.
5. Dropdown закрывается по клику вне меню и выглядит одинаково во всех модулях.

Источник стандарта: `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER.md` и `header.json`.
Для обязательной проверки при внедрении: `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER_CHECKLIST.md`.

## Отказоустойчивость

Все модули кэшируют результат валидации сессии UAM **локально**:

| Ситуация | Поведение |
|----------|-----------|
| UAM доступен | Кэш обновляется каждые 60 сек |
| UAM недоступен / упал / перезапуск | Кэш работает до 72 часов — пользователи НЕ вылетают |
| UAM wipe (полная очистка БД) | Кэш работает — пользователи НЕ вылетают |
| Пользователь нажал "выйти везде" | Только тогда кэш удаляется (`reason: "revoked"`) |
| UAM недоступен + нет кэша | Новый вход невозможен до восстановления |

Подробнее: [UAM Plugin → Отказоустойчивость](./uam/README.md#отказоустойчивость-graceful-degradation)

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

## Поддерживаемые платформы

- **JavaScript / Node.js** — npm пакет (планируется)
- **Python** — pip пакет (планируется)
- **PHP / WordPress** — WP-плагин (в каждом модуле есть пример)
- **REST API** — любая платформа через HTTP
