# MarkBase CORE — Plugins

Официальные плагины для интеграции модулей MarkBase в ваши проекты.

> **Источник единого стандарта** (домены/порты/контракты — сначала правятся здесь):
> `markbaseCORE/INTEGRATION/PLATFORM_BASELINE.md` и `markbaseCORE/INTEGRATION/platform-registry.json`.

---

## Точка входа

Эта папка — тонкий индекс. Вся публичная документация и каталог модулей живут в **`PUBLIC/`**:

| Куда идти | Что внутри |
|-----------|------------|
| [`PUBLIC/README.md`](./PUBLIC/README.md) | Обзор для разработчиков: Марбэйс id, принципы, безопасность, быстрый старт |
| [`PUBLIC/plugins/README.md`](./PUBLIC/plugins/README.md) | **Каталог модулей** (версии, slug, порты, домены) |
| [`PUBLIC/plugins/<slug>/plugin.json`](./PUBLIC/plugins/) | **SSOT версии и контракта** каждого модуля |
| [`PUBLIC/auth-widget/`](./PUBLIC/auth-widget/) | Кнопка «Войти через Марбэйс id» (OAuth 2.0 + PKCE) |
| [`PUBLIC/MARKBASE_PLUGINS_OUR_SIDE.md`](./PUBLIC/MARKBASE_PLUGINS_OUR_SIDE.md) | Что настроить на стороне внешнего проекта (CSP, CORS, return_url) |

> **Версии модулей не дублируются здесь** — единственный источник истины это `plugin.json` каждого модуля и каталог `PUBLIC/plugins/README.md`.

---

## Принципы (кратко)

1. **Единый вход** — все модули используют UAM (Марбэйс id).
2. **Cookie-based SSO** — `uam_session` на домене `.markbase.ru`.
3. **HMAC-подпись** — межмодульные запросы подписываются HMAC-SHA256.
4. **API Namespace** — `/api/<slug>/v1/*`.
5. **Семантическое версионирование** — major.minor.patch.
6. **Отказоустойчивость** — локальный кэш сессий UAM на каждом модуле.

Единый стандарт аккаунт-меню и UX — `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER.md` (детали — в [`PUBLIC/README.md`](./PUBLIC/README.md)).
