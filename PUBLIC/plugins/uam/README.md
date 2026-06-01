# Plugin: UAM (WaySenID) — Единая аутентификация

> **Версия:** 1.5.0
> **Slug:** `uam`
> **Endpoint:** `https://auth.markbase.ru`
> **Cookie:** `uam_session` на `.markbase.ru`

---

## Обзор

UAM (WaySenID) — централизованный сервис аутентификации платформы MarkBase. Все модули и сторонние проекты используют единый вход через UAM.

**Принцип:** пользователь регистрируется и входит **один раз** через auth.markbase.ru. Cookie `uam_session` действует на всех поддоменах `.markbase.ru`. Сторонние проекты валидируют сессию через API.

### Что нового в v1.5.0

- **Переключение без пароля** — при смене аккаунта пароль не запрашивается, если владелец аккаунта не включил «Всегда запрашивать пароль» и с последнего входа прошло меньше N дней (по умолчанию 180). Сторонние модули **обязаны** реализовать ту же логику (см. спецификацию Account Switcher).
- **POST /switch-with-token** — переключение по токену; настройки в разделе «Безопасность»: всегда пароль / только после долгого невхода.
- **Метки устройств** — в списке сессий можно задать название устройства (PATCH /sessions/:id).

### Что нового в v1.4.0

- **Account Switcher** — переключение между аккаунтами прямо из шапки любого модуля + добавление новых аккаунтов
- **`?switch=email`** — URL-параметр для быстрого переключения (пропускает Account Picker → сразу ввод пароля)
- **`?new_account=1`** — URL-параметр для добавления нового аккаунта (сразу ввод email)
- **GET /logout с redirect** — выход через ссылку с `?return_url=` (для PHP/WordPress/HTML интеграций)
- **Спецификация Account Switcher** — полная документация с готовым React-компонентом для реализации в любом модуле
- **Проверка email перед входом** — `POST /check-email` определяет, существует ли аккаунт, до ввода пароля
- **Умный UX логина** — если аккаунт не найден → предложение зарегистрироваться с автозаполнением email
- **Умный UX регистрации** — если аккаунт уже существует → предложение войти
- **Различение ошибок** — backend возвращает `reason: 'user_not_found'` (логин) и `reason: 'email_taken'` (регистрация)
- **Передача email между страницами** — URL-параметр `?email=` для бесшовного перехода между логином и регистрацией

### Что нового в v1.3.0

- **Полный редизайн** — интерфейс в стиле Yandex ID
- **Многоуровневая защита** — brute-force, DDoS, rate limiting, IP-блокировка
- **Captcha** — интеграция с MarkBase Captcha (собственная + Яндекс + Google) на регистрации и входе
- **Выбор аккаунтов** — до 5 запомненных аккаунтов с удалением/переключением
- **Управление IP** — пользователи могут ограничивать вход только с доверенных IP
- **Центр безопасности** — оценка защиты, история входов, статус модулей
- **Прогрессивная блокировка** — при 10+ неудачных попытках IP блокируется на 60→120→240 мин
- **Аудит** — полное логирование входов, смены паролей, отзыва сессий

---

## Схема работы

```
┌──────────────┐    1. Redirect     ┌──────────────────┐
│  Ваш проект  │ ────────────────> │  auth.markbase.ru │
│  (любой)     │                    │     Login Page    │
└──────┬───────┘                    └────────┬─────────┘
       │                                      │
       │   4. Redirect back                   │ 2. POST /api/uam/v1/login
       │   + cookie uam_session               │    {email, password}
       │ <────────────────────────────────────│
       │                                      │ 3. Set-Cookie: uam_session
       │                                      │    Domain: .markbase.ru
       ▼
┌──────────────┐    5. Validate      ┌──────────────────┐
│  Ваш Backend │ ────────────────> │  UAM Internal API │
│              │                    │  /session/validate│
│              │ <──────────────── │  {user_id, email} │
└──────────────┘    6. User data     └──────────────────┘
```

### Проекты с собственной регистрацией («Войти как»)

Если у вас **своя форма входа/регистрации** и вы хотите добавить WaySenID как ещё один способ (аналогично «Войти через Google» / «Яндекс»): одна кнопка «Войти через WaySenID», без дублирования форм и капчи. Данные пользователя передаются через cookie (на \*.markbase.ru) или через одноразовый `wsid_code` + `POST /exchange-code` (на стороннем домене).

→ **[WAYSENID_LOGIN_AS.md](../../WAYSENID_LOGIN_AS.md)** — пошаговое подключение, два варианта (тот же домен / сторонний домен), формат данных, чеклист.

---

## Многоуровневая система защиты

> **v1.3.0** — UAM включает **10 модулей безопасности**, которые работают автоматически.

### Модули защиты

| # | Модуль | Описание | Параметры |
|---|--------|----------|-----------|
| 1 | **Brute-Force Protection** | Ограничение попыток входа по IP + email | 10 попыток / 30 мин |
| 2 | **Progressive Lockout** | Нарастающая блокировка IP при повторных нарушениях | 60 → 120 → 240 мин |
| 3 | **IP Auto-Block** | Автоматическое занесение IP в таблицу `blocked_ips` | До истечения lockout |
| 4 | **Global Rate Limiter** | Ограничение всех API-запросов с одного IP | 120 запросов / 60 сек |
| 5 | **Auth Rate Limiter** | Дополнительное ограничение на `/login`, `/register` | 20 запросов / 60 сек |
| 6 | **IP Allowlist** | Пользовательская фильтрация — вход только с доверенных IP | Настраивается пользователем |
| 7 | **Password Policy** | Требования к паролю: длина, регистр, цифры | Мин. 8 символов, A-z + 0-9 |
| 8 | **Security Headers** | HSTS, X-Frame-Options, X-XSS-Protection, no-cache | Автоматически |
| 9 | **Audit Logging** | Логирование всех действий и событий безопасности | В таблицу `audit_log` |
| 10 | **Session Security** | HTTP-only cookies, TTL, отзыв сессий | 72 часа TTL |
| 11 | **Captcha Protection** | MarkBase Captcha обязательна на регистрации. На входе — backend conditional middleware (готов к включению при необходимости), основная защита входа через brute-force + IP-block | Собственная + Яндекс + Google |

### Ответы при блокировке

**Аккаунт не найден (v1.4.0):**
```json
{
  "error": "Аккаунт с таким email не найден",
  "reason": "user_not_found",
  "failed_count": 1,
  "remaining_attempts": 9,
  "max_attempts": 10,
  "window_minutes": 30
}
```

**При неудачном входе (неверный пароль, попытки ещё есть):**
```json
{
  "error": "Неверные учетные данные",
  "failed_count": 3,
  "remaining_attempts": 7,
  "max_attempts": 10,
  "window_minutes": 30,
  "warning": null
}
```

**При неудачном входе (осталось ≤ 3 попытки):**
```json
{
  "error": "Неверные учетные данные",
  "failed_count": 8,
  "remaining_attempts": 2,
  "max_attempts": 10,
  "window_minutes": 30,
  "warning": "Осталось попыток: 2 из 10"
}
```

**При блокировке IP (brute-force, превышен лимит):**
```json
{
  "error": "Превышено максимальное количество попыток (10). IP заблокирован на 60 мин.",
  "failed_count": 10,
  "max_attempts": 10,
  "remaining_attempts": 0,
  "retry_after_minutes": 60,
  "protection": "brute_force_block"
}
```

**При заблокированном IP (повторная попытка):**
```json
{
  "error": "IP-адрес временно заблокирован. Повторите через 45 мин.",
  "reason": "brute_force",
  "blocked_until": "2026-02-09T13:00:00.000Z",
  "retry_after_seconds": 2700,
  "attempts_count": 12,
  "protection": "ip_blocked"
}
```

**При auth rate limit (20 req/min):**
```json
{
  "error": "Слишком много попыток авторизации. Подождите минуту.",
  "retry_after_seconds": 45,
  "protection": "auth_rate_limit"
}
```

**При global rate limit (120 req/min):**
```json
{
  "error": "Слишком много запросов. Пожалуйста, подождите.",
  "retry_after_seconds": 30,
  "protection": "rate_limit"
}
```

### Таблицы БД для безопасности

```sql
-- Попытки входа (brute-force tracking)
uam.login_attempts (attempt_id, ip_address, email, success, created_at)

-- Автоблокированные IP
uam.blocked_ips (id, ip_address, reason, blocked_until, violation_count, created_at)

-- Настройки безопасности пользователя
uam.user_security_settings (user_id, two_factor_enabled, last_password_change, ...)

-- Аудит-лог
uam.audit_log (log_id, user_id, action, ip_address, user_agent, metadata, created_at)

-- IP-фильтрация пользователей
uam.user_ip_allowlist (id, user_id, ip_address, label, created_by, created_at)
```

---

## Отказоустойчивость (Graceful Degradation)

> **ПРИНЦИП:** Что бы ни происходило на сервере UAM — перезапуск, wipe БД, падение — пользователи
> **НИКОГДА не вылетают** из кабинетов. Только ЯВНЫЕ действия самого пользователя могут завершить сессию.

### Что может разлогинить пользователя

| Действие | Кто инициирует | Результат |
|----------|---------------|-----------|
| Нажал "Выйти из всех устройств" | Пользователь | Все сессии завершены |
| Сменил пароль с "выйти везде" | Пользователь | Все сессии кроме текущей завершены |
| Cookie `uam_session` истекла | Браузер (авто) | Сессия истекла естественно (72ч) |

### Что НЕ влияет на пользователей

| Ситуация | Поведение |
|----------|-----------|
| UAM перезапустился | Кэш работает, пользователь не замечает |
| UAM БД была очищена (wipe) | Кэш работает, пользователь не замечает |
| UAM вернул 500/503 | Кэш работает, пользователь не замечает |
| UAM полностью недоступен | Кэш работает до 72 часов |
| Сессия "не найдена" в UAM | Кэш работает (возможно wipe) |

### Как это работает: поле `reason` в ответе UAM

Эндпоинт `GET /api/uam/v1/session/validate` при ошибке возвращает `reason`:

```json
// Сессия ЯВНО отозвана пользователем → удаляем кэш, разлогиниваем
{ "error": "Недействительная сессия", "reason": "revoked" }

// Сессия не найдена (wipe, рестарт) → НЕ удаляем кэш
{ "error": "Недействительная сессия", "reason": "not_found" }

// Сессия истекла по TTL → НЕ удаляем кэш (cookie тоже истечёт)
{ "error": "Недействительная сессия", "reason": "expired" }
```

### Параметры кэша

| Параметр | Значение | Описание |
|----------|----------|----------|
| `CACHE_TTL` | 259 200 сек (72 часа) | Совпадает с TTL сессии UAM |
| `CACHE_REFRESH` | 60 сек (1 мин) | Фоновое обновление при доступном UAM |
| `CACHE_MAX` | 10 000 | Максимум записей в памяти |

### Логика

```
Запрос пользователя
    │
    ├── Cookie нет → return null (не залогинен)
    │
    ├── Кэш свежий (< 60 сек) → return кэш (не дёргаем UAM)
    │
    └── Запрос к UAM /session/validate
           │
           ├── 200 OK        → кэшируем + return user
           ├── 401 "revoked" → пользователь ЯВНО отозвал → удаляем кэш, return null
           ├── 401 другое    → wipe/рестарт → return кэш (пользователь работает!)
           ├── 500/503       → return кэш
           └── Timeout       → return кэш
```

---

## Полный цикл: Вход, Регистрация, Запоминание аккаунтов

### Вход (Login) — Стиль Yandex ID

```
Пользователь → Ваш проект (/dashboard)
   │
   ├── Cookie uam_session есть?
   │     ├── Да → валидация (см. кэш) → показать dashboard
   │     └── Нет → redirect на auth.markbase.ru/login?return_url=...
   │
auth.markbase.ru/login
   │
   ├── Есть запомненные аккаунты?
   │     ├── Да → Шаг 1: Выбор аккаунта (список карточек)
   │     │         ├── Выбрал аккаунт → Шаг 3: Ввод пароля
   │     │         ├── «Другой аккаунт» → Шаг 2: Ввод email
   │     │         └── Удалить аккаунт → Удаляем из localStorage
   │     └── Нет → Шаг 2: Ввод email
   │
   ├── Шаг 2: Ввод email → POST /check-email (v1.4.0)
   │     ├── exists: true → Шаг 3: Ввод пароля
   │     └── exists: false → «Аккаунт не найден» + кнопка «Зарегистрироваться»
   │                          (переход на /register?email=... с автозаполнением)
   │
   ├── Шаг 3: Ввод пароля
   │     ├── Карточка выбранного аккаунта (аватар, имя, email)
   │     ├── Поле пароля
   │     ├── Индикатор оставшихся попыток (прогресс-бар)
   │     ├── Предупреждение при ≤ 3 попытках
   │     └── Блокировка с таймером при превышении лимита
   │
   ├── POST /api/uam/v1/login → Brute-force проверка → Set-Cookie
   ├── Аккаунт запоминается в localStorage браузера
   └── Redirect обратно на return_url → ваш /dashboard
```

### Регистрация (Register)

```
Пользователь → Ваш проект (/register или кнопка "Зарегистрироваться")
   │
   └── Redirect на auth.markbase.ru/register?return_url=...

auth.markbase.ru/register[?email=user@example.com]
   │
   ├── Шаг 1: Email (автозаполняется из ?email= параметра)
   │     ├── POST /check-email (v1.4.0)
   │     │     ├── exists: false → продолжить регистрацию
   │     │     └── exists: true → «Аккаунт уже существует» + кнопка «Войти»
   │
   ├── Поля: Email, Пароль, Подтверждение пароля, Имя, Компания
   │
   ├── Валидация пароля в реальном времени:
   │     ├── ✅ Минимум 8 символов
   │     ├── ✅ Заглавная буква
   │     ├── ✅ Строчная буква
   │     └── ✅ Цифра
   │
   ├── Индикатор сложности: Слабый → Средний → Хороший → Отличный
   │
   ├── POST /api/uam/v1/register
   │     → Проверяет сложность пароля (backend)
   │     → Создаёт пользователя
   │     → Автоматически подписывает обязательные согласия
   │     → Создаёт сессию + Set-Cookie
   │     → Аккаунт запоминается в localStorage
   └── Redirect обратно на return_url → ваш /dashboard
```

### API: Проверка email (v1.4.0)

```bash
POST https://auth.markbase.ru/api/uam/v1/check-email
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Ответ (200):**
```json
{
  "exists": true,
  "email": "user@example.com"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `exists` | boolean | `true` — аккаунт найден, `false` — не существует |
| `email` | string | Нормализованный email |

> **Защита:** Endpoint защищён `authRateLimiter` (20 req/min per IP). При ошибке сервера возвращает `exists: false` (не раскрывает информацию).

> **Применение:** Вызывается автоматически на фронтенде при вводе email на страницах Login и Register для улучшения UX — пользователь сразу узнаёт, нужно ли регистрироваться или входить.

### API: Регистрация

```bash
POST https://auth.markbase.ru/api/uam/v1/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "display_name": "Иван Петров",
  "company_name": "ООО Ромашка"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "user": {
    "user_id": "...",
    "email": "user@example.com",
    "display_name": "Иван Петров",
    "role": "user"
  },
  "verification_required": false
}
```

**Ошибки:**
| Код | Ошибка | Причина |
|-----|--------|---------|
| 400 | Email и пароль обязательны | Не переданы обязательные поля |
| 400 | Пароль должен быть не менее 8 символов | Слишком короткий пароль |
| 400 | Пароль должен содержать заглавные и строчные буквы, а также цифры | Не соответствует политике |
| 409 | Аккаунт с таким email уже существует (reason: `email_taken`) | Email уже занят, frontend предлагает войти |
| 429 | Слишком много запросов | Rate limit превышен |

### Запоминание аккаунтов

WaySenID автоматически запоминает аккаунты, с которых пользователь входил, в `localStorage` браузера:

| Ключ | Описание |
|------|----------|
| `wsid_last_email` | Последний email для быстрого входа |
| `wsid_last_name` | Display name последнего пользователя |
| `wsid_accounts` | JSON-массив до 5 последних аккаунтов |

**Формат `wsid_accounts`:**
```json
[
  { "email": "user@example.com", "display_name": "Иван Петров", "last_login": "2026-02-08T12:00:00Z" },
  { "email": "admin@company.ru", "display_name": "Администратор", "last_login": "2026-02-07T10:00:00Z" }
]
```

**Поведение на странице входа (v1.3.0):**
- Несколько аккаунтов → **Шаг «Выбор аккаунта»** — карточки с аватарами, именами и замаскированными email
- Кнопка удаления для каждого аккаунта (крестик)
- Кнопка «Войти другим аккаунтом» → переход к вводу email
- Нет аккаунтов → сразу форма ввода email

**Если ваш проект на другом домене** (не `*.markbase.ru`):
- Cookie `uam_session` не будет доступна автоматически
- Используйте API `POST /api/uam/v1/login` напрямую
- Сохраняйте токен из ответа в своей системе
- Или используйте redirect-flow через `return_url`

---

## Переключение аккаунтов (Account Switcher) — Спецификация для ВСЕХ модулей

> **v1.4.0** — Каждый модуль платформы **обязан** реализовать переключение аккаунтов в шапке.
> Пользователь должен иметь возможность в любой момент переключиться на другой аккаунт или добавить новый.

### Как это выглядит

При нажатии на аватар/профиль в правом верхнем углу шапки **любого** модуля отображается dropdown:

```
┌──────────────────────────────────────┐
│  [Аватар] Иван Петров        ✓      │  ← Текущий аккаунт (активный)
│           ivan@example.com           │
│           Администратор              │
├──────────────────────────────────────┤
│  ⇄ ПЕРЕКЛЮЧИТЬ АККАУНТ              │  ← Заголовок (если есть другие)
│                                      │
│  [Аватар] Мария Смирнова     ✕      │  ← Другой сохранённый аккаунт
│           ma***@company.ru           │
│                                      │
│  [Аватар] Admin              ✕      │  ← Ещё один сохранённый
│           su***@markbase.ru          │
├──────────────────────────────────────┤
│  ＋ Добавить аккаунт                 │  ← Войти новым аккаунтом
├──────────────────────────────────────┤
│  👤 Управление аккаунтом             │  ← Переход на auth.markbase.ru
│  🔑 Безопасность                     │
├──────────────────────────────────────┤
│  🚪 Выйти                            │
└──────────────────────────────────────┘
```

### Логика переключения аккаунтов (обязательна для всех модулей)

Переключение должно **не запрашивать пароль**, если целевой аккаунт недавно входил с этого устройства и у пользователя не включена настройка «Всегда запрашивать пароль». Иначе — переход на страницу ввода пароля.

```
Пользователь нажимает на другой аккаунт в dropdown
    │
    ├── 1. Взять из localStorage (wsid_accounts) запись целевого аккаунта:
    │      email, switch_token, require_password_on_switch, switch_inactivity_days, last_login
    │
    ├── 2. Решить: нужен ли пароль?
    │      • require_password_on_switch === 'always' → ДА
    │      • нет switch_token → ДА
    │      • (сейчас − last_login) > switch_inactivity_days (по умолчанию 180 дней) → ДА
    │      • иначе → пароль НЕ запрашивать
    │
    ├── 3a. Если пароль НЕ нужен:
    │      POST /api/uam/v1/switch-with-token
    │      Body: { email, switch_token }
    │      Credentials: include (cookie)
    │      → 200: Set-Cookie новая сессия → redirect на return_url (или /account)
    │      → 403 / ошибка: fallback на 3b
    │
    └── 3b. Если пароль нужен (или 3a вернул ошибку):
           POST /api/uam/v1/logout (завершаем текущую сессию)
           Redirect: auth.markbase.ru/login?switch=email@example.com
                     [&return_url=https://billing.markbase.ru/dashboard]
           На странице входа: шаг «Ввод пароля» → POST /login → Set-Cookie → redirect на return_url
```

### Безопасность переключения без пароля

- **Switch token** выдаётся только при успешном входе по паролю (POST /login). Хранится в `wsid_accounts` и на сервере (таблица `switch_tokens`), срок жизни по умолчанию 30 дней (переменная `UAM_SWITCH_TOKEN_TTL_DAYS`).
- **Настройки задаёт владелец аккаунта** в разделе «Безопасность» (auth.markbase.ru):
  - **«Всегда запрашивать пароль»** — при любом переключении на этот аккаунт всегда показывается ввод пароля; никто не сможет войти с вашего устройства без пароля.
  - **«Только после долгого невхода»** (рекомендуется) — переключение без пароля разрешено, если с последнего входа в этот аккаунт с этого устройства прошло меньше N дней (по умолчанию 180).
- **Сторонние модули обязаны** использовать одну и ту же логику: проверять `require_password_on_switch`, `last_login` и `switch_inactivity_days` из `wsid_accounts`, при возможности вызывать `POST /switch-with-token`, иначе — редирект на `login?switch=email&return_url=...`. Не реализовывать «всегда редирект на пароль» — это ухудшает UX и не соответствует политике безопасности UAM.

### Логика добавления нового аккаунта

```
Пользователь нажимает «Добавить аккаунт»
    │
    ├── 1. POST /api/uam/v1/logout (завершаем текущую сессию)
    │
    ├── 2. Redirect:
    │      auth.markbase.ru/login?new_account=1
    │      [&return_url=https://billing.markbase.ru/dashboard]
    │
    └── 3. Страница входа (Login.js):
           ├── Параметр ?new_account=1 → сразу показать шаг «Ввод email»
           │   (пропускаем шаг «Выбор аккаунта»)
           ├── Пользователь вводит email нового аккаунта
           ├── POST /check-email → проверка
           ├── Ввод пароля → POST /login → Set-Cookie
           ├── Новый аккаунт запоминается в wsid_accounts
           └── Redirect обратно на return_url → модуль
```

### URL-параметры страницы входа (Login)

| Параметр | Описание | Пример |
|----------|----------|--------|
| `return_url` | Куда вернуть после успешного входа | `?return_url=https://billing.markbase.ru/dashboard` |
| `switch` | Email аккаунта для быстрого переключения — сразу показывает ввод пароля | `?switch=admin@markbase.ru` |
| `new_account` | Принудительно показать ввод email (для добавления нового аккаунта) | `?new_account=1` |
| `email` | Предзаполнить email (для перехода из регистрации) | `?email=user@example.com` |

### localStorage: Хранение аккаунтов

Все модули **разделяют один и тот же localStorage** на домене `*.markbase.ru`.
Ключи стандартизированы — **не изменяйте имена ключей!**

| Ключ | Тип | Описание |
|------|-----|----------|
| `wsid_accounts` | `JSON Array` | Массив до 5 сохранённых аккаунтов |
| `wsid_last_email` | `string` | Email последнего входа |
| `wsid_last_name` | `string` | Display name последнего входа |

**Формат `wsid_accounts`:**
```json
[
  {
    "email": "ivan@example.com",
    "display_name": "Иван Петров",
    "last_login": "2026-02-09T12:00:00.000Z",
    "switch_token": "hex-токен от UAM (выдаётся при входе по паролю)",
    "require_password_on_switch": "always | after_inactivity",
    "switch_inactivity_days": 180
  },
  {
    "email": "admin@markbase.ru",
    "display_name": "System Administrator",
    "last_login": "2026-02-09T10:34:00.000Z",
    "switch_token": "...",
    "require_password_on_switch": "after_inactivity",
    "switch_inactivity_days": 180
  }
]
```

Поля `switch_token`, `require_password_on_switch`, `switch_inactivity_days` приходят в ответе POST /login и сохраняются при вызове `rememberAccount(email, displayName, options)`. Они нужны для переключения без пароля в рамках правил безопасности.

**Правила:**
- Максимум 5 аккаунтов (FIFO — новые вытесняют старые)
- При успешном входе аккаунт **добавляется** в начало массива с токеном и настройками из ответа /login
- При удалении аккаунта — он удаляется из массива
- Все операции через `safeGet`/`safeSet` (try-catch для Safari private mode)

### Helper-функции для работы с аккаунтами (JavaScript)

```javascript
/* ═══════════════════════════════════════════════════════
 * WaySenID Account Helpers
 * Используйте в ЛЮБОМ модуле для работы с сохранёнными аккаунтами.
 * Эти функции совместимы с Login.js и Layout.js auth.markbase.ru.
 * ═══════════════════════════════════════════════════════ */

const ACCOUNTS_KEY = 'wsid_accounts';
const LAST_EMAIL_KEY = 'wsid_last_email';
const LAST_NAME_KEY = 'wsid_last_name';

// Безопасный доступ к localStorage (Safari private mode)
const safeGet = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };

// Получить список сохранённых аккаунтов
function getSavedAccounts() {
  try {
    const raw = safeGet(ACCOUNTS_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

// Запомнить аккаунт после успешного входа по паролю.
// options: { switch_token, require_password_on_switch, switch_inactivity_days } — из ответа POST /login
function rememberAccount(email, displayName, options = {}) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return;
  safeSet(LAST_EMAIL_KEY, normalized);
  if (displayName) safeSet(LAST_NAME_KEY, displayName);
  let accounts = getSavedAccounts();
  accounts = accounts.filter(a => a.email !== normalized);
  const entry = {
    email: normalized,
    display_name: displayName || normalized,
    last_login: new Date().toISOString()
  };
  if (options.switch_token) entry.switch_token = options.switch_token;
  if (options.require_password_on_switch) entry.require_password_on_switch = options.require_password_on_switch;
  if (options.switch_inactivity_days != null) entry.switch_inactivity_days = options.switch_inactivity_days;
  accounts.unshift(entry);
  accounts = accounts.slice(0, 5); // Максимум 5
  safeSet(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Удалить аккаунт из списка
function forgetAccount(email) {
  let accounts = getSavedAccounts();
  accounts = accounts.filter(a => a.email !== email);
  safeSet(ACCOUNTS_KEY, JSON.stringify(accounts));
  return accounts;
}

// Маскировать email (для отображения)
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const masked = local.length <= 2 ? local[0] + '***' : local.slice(0, 2) + '***';
  return masked + '@' + domain;
}

// Цвета аватаров (стабильные по email)
const AVATAR_COLORS = ['#FC3F1D', '#5B45FF', '#00A884', '#FF6F00', '#0077FF', '#E91E63', '#9C27B0', '#00BCD4'];
function getAvatarColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Инициалы для аватара
function getInitials(name, email) {
  if (name && name !== email) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return (email || '?')[0].toUpperCase();
}
```

### Готовый React-компонент: AccountSwitcher для любого модуля

> Скопируйте этот компонент в шапку вашего модуля. Он автоматически:
> - показывает текущего пользователя
> - показывает другие сохранённые аккаунты
> - позволяет переключаться и добавлять новые

```javascript
import React, { useState, useEffect } from 'react';
import { Avatar, Dropdown } from 'antd';
// Импортируйте helper-функции выше или скопируйте их

const UAM_URL = 'https://auth.markbase.ru';

/**
 * AccountSwitcher — dropdown для переключения аккаунтов в шапке модуля.
 *
 * @param {Object} props
 * @param {Object} props.user - Текущий пользователь { email, display_name, role }
 * @param {Function} props.onLogout - Callback при выходе (optional)
 * @param {string} props.returnUrl - URL для возврата после переключения (optional)
 */
function AccountSwitcher({ user, onLogout, returnUrl }) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    setAccounts(getSavedAccounts());
  }, []);

  const currentReturnUrl = returnUrl || window.location.href;
  const otherAccounts = accounts.filter(a => a.email !== user?.email);

  // Переключение: если разрешено настройками и есть токен — POST /switch-with-token, иначе — logout + redirect на ввод пароля
  const handleSwitch = async (email) => {
    const acc = accounts.find(a => a.email === email);
    const inactivityDays = (acc?.switch_inactivity_days != null ? acc.switch_inactivity_days : 180);
    const requirePassword = acc?.require_password_on_switch || 'after_inactivity';
    const lastLogin = acc?.last_login ? new Date(acc.last_login).getTime() : 0;
    const inactivityMs = inactivityDays * 24 * 60 * 60 * 1000;
    const needPassword = requirePassword === 'always' ||
      !acc?.switch_token ||
      (Date.now() - lastLogin > inactivityMs);

    if (needPassword) {
      try {
        await fetch(`${UAM_URL}/api/uam/v1/logout`, { method: 'POST', credentials: 'include' });
      } catch (_) {}
      window.location.href = `${UAM_URL}/login?switch=${encodeURIComponent(email)}&return_url=${encodeURIComponent(currentReturnUrl)}`;
      return;
    }
    try {
      const res = await fetch(`${UAM_URL}/api/uam/v1/switch-with-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, switch_token: acc.switch_token })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.location.href = currentReturnUrl;
        return;
      }
    } catch (_) {}
    window.location.href = `${UAM_URL}/login?switch=${encodeURIComponent(email)}&return_url=${encodeURIComponent(currentReturnUrl)}`;
  };

  // Добавить новый: logout → redirect на login с new_account
  const handleAddAccount = async () => {
    try {
      await fetch(`${UAM_URL}/api/uam/v1/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (_) {}
    window.location.href = `${UAM_URL}/login?new_account=1&return_url=${encodeURIComponent(currentReturnUrl)}`;
  };

  // Удалить аккаунт из сохранённых
  const handleRemove = (email) => {
    const updated = forgetAccount(email);
    setAccounts(updated);
  };

  // Выход
  const handleLogout = async () => {
    try {
      await fetch(`${UAM_URL}/api/uam/v1/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (_) {}
    if (onLogout) onLogout();
    else window.location.href = `${UAM_URL}/login?return_url=${encodeURIComponent(currentReturnUrl)}`;
  };

  const color = getAvatarColor(user?.email);
  const initials = getInitials(user?.display_name, user?.email);

  const items = [
    // Текущий аккаунт
    {
      key: 'current',
      label: (
        <div style={{ padding: '8px 0', minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size={40} style={{ background: color, fontWeight: 600 }}>{initials}</Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {user?.display_name || 'Пользователь'} ✓
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{user?.email}</div>
            </div>
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },

    // Другие аккаунты
    ...(otherAccounts.length > 0 ? [
      { key: 'switch-header', label: '⇄ Переключить аккаунт', disabled: true },
      ...otherAccounts.map(acc => ({
        key: `switch-${acc.email}`,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={28} style={{ background: getAvatarColor(acc.email), fontWeight: 600, fontSize: 11 }}>
              {getInitials(acc.display_name, acc.email)}
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{acc.display_name || acc.email}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{maskEmail(acc.email)}</div>
            </div>
          </div>
        ),
        onClick: () => handleSwitch(acc.email),
      })),
      { type: 'divider' },
    ] : []),

    // Добавить аккаунт
    { key: 'add', label: '＋ Добавить аккаунт', onClick: handleAddAccount },
    { type: 'divider' },

    // Управление
    {
      key: 'manage',
      label: '👤 Управление аккаунтом',
      onClick: () => { window.location.href = `${UAM_URL}/account`; },
    },
    { type: 'divider' },

    // Выход
    { key: 'logout', label: '🚪 Выйти', danger: true, onClick: handleLogout },
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
      <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar size={32} style={{ background: color, fontWeight: 600, fontSize: 13 }}>
          {initials}
        </Avatar>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {user?.display_name || user?.email}
        </span>
      </div>
    </Dropdown>
  );
}
```

**Использование в любом модуле (React):**
```javascript
// В шапке вашего модуля:
<AccountSwitcher
  user={currentUser}                       // { email, display_name, role }
  returnUrl="https://billing.markbase.ru"  // Куда вернуть после переключения
  onLogout={() => { setUser(null); }}      // Callback при выходе (optional)
/>
```

### Для НЕ-React модулей (Redirect-подход)

Если модуль не на React, но поддерживает JavaScript:
- Реализуйте ту же логику переключения: прочитайте `wsid_accounts`, при возможности вызовите `POST /switch-with-token` с `credentials: 'include'`, при успехе — redirect на return_url, иначе — redirect на `login?switch=email&return_url=...`. Так переключение будет без запроса пароля там, где это разрешено настройками.

Если используете только ссылки (без проверки токена):

```html
<!-- Переключить на конкретный аккаунт (всегда приведёт к вводу пароля на странице логина) -->
<a href="https://auth.markbase.ru/login?switch=other@email.com&return_url=https://billing.markbase.ru/dashboard">
  Переключить на other@email.com
</a>

<!-- Добавить новый аккаунт -->
<a href="https://auth.markbase.ru/login?new_account=1&return_url=https://billing.markbase.ru/dashboard">
  Добавить аккаунт
</a>

<!-- Выход с redirect обратно -->
<a href="https://auth.markbase.ru/api/uam/v1/logout?return_url=https://billing.markbase.ru">
  Выйти
</a>
```

### Экран выбора аккаунта (Account Picker на Login)

Когда пользователь попадает на `auth.markbase.ru/login` и в `wsid_accounts` есть сохранённые аккаунты, отображается **Account Picker** (как на скриншоте):

```
┌──────────────────────────────────────────┐
│           [🔶 WaySenID Logo]             │
│              WaySenID                    │
│          Выберите аккаунт                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ [SA] System Administrator      🗑  │  │  ← Карточка аккаунта
│  │      su***@markbase.ru             │  │     (клик → ввод пароля)
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ [ИП] Иван Петров              🗑  │  │  ← Ещё один аккаунт
│  │      iv***@example.com             │  │
│  └────────────────────────────────────┘  │
│                                          │
│            ──── или ────                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  👤 Войти другим аккаунтом         │  │  ← Ввод нового email
│  └────────────────────────────────────┘  │
│                                          │
│    Нет аккаунта? Зарегистрироваться      │
│                                          │
│  ✅ 7/7 модулей защиты активны           │
│  🔒 HTTPS  🛡 Anti-Bruteforce  ⚡ Anti-DDoS │
│                                          │
│     WaySenID v1.4 · MarkBase · 2026     │
└──────────────────────────────────────────┘
```

**Элементы карточки аккаунта:**
- **Цветной аватар** — стабильный цвет по hash от email (8 цветов)
- **Инициалы** — первые буквы display_name или первая буква email
- **Имя** — display_name или email целиком
- **Замаскированный email** — `su***@markbase.ru` (первые 2 символа + `***`)
- **Кнопка удаления** — иконка корзины, удаляет аккаунт из localStorage

**Поведение:**
1. Клик на карточку → переход к вводу пароля (Шаг 3)
2. Клик на «Войти другим аккаунтом» → переход к вводу email (Шаг 2)
3. Клик на 🗑 → удаление аккаунта из `wsid_accounts`, если аккаунтов не осталось → автоматический переход к вводу email
4. При `?switch=email` → шаг выбора пропускается, сразу ввод пароля для указанного email
5. При `?new_account=1` → шаг выбора пропускается, сразу ввод нового email

### Чек-лист для модулей: Интеграция Account Switcher

Каждый модуль платформы **должен** реализовать:

- [ ] **Dropdown в шапке** при клике на аватар/профиль пользователя
- [ ] **Текущий аккаунт** — отображение имени, email, роли
- [ ] **Список других аккаунтов** из `localStorage` ключа `wsid_accounts` (с полями `switch_token`, `require_password_on_switch`, `switch_inactivity_days`, `last_login`)
- [ ] **Переключение** — по логике безопасности UAM: из `wsid_accounts` взять целевой аккаунт; если `require_password_on_switch !== 'always'` и есть `switch_token` и не истёк срок невхода (`last_login` + `switch_inactivity_days`) → `POST /api/uam/v1/switch-with-token` с `{ email, switch_token }`, затем redirect на return_url; иначе → `POST /logout` + redirect на `auth.markbase.ru/login?switch=email&return_url=...`
- [ ] **Добавление нового** — logout + redirect на `auth.markbase.ru/login?new_account=1&return_url=...`
- [ ] **Удаление аккаунта** — удаление из `wsid_accounts` (не затрагивает сессии)
- [ ] **Выход** — `POST /api/uam/v1/logout` + redirect на login
- [ ] **Ссылка на управление аккаунтом** — redirect на `auth.markbase.ru/account`

---

## Личный кабинет (Personal Account)

### Страницы личного кабинета

| Страница | URL | Описание |
|----------|-----|----------|
| **Профиль** | `/account` | Просмотр и редактирование имени, email, компании |
| **Сессии** | `/account/sessions` | Активные сессии, IP, устройства, отзыв сессий |
| **Модули** | `/account/modules` | Каталог подключённых модулей платформы |
| **Согласия** | `/account/consents` | Правовые документы, предоставление/отзыв согласий |
| **Безопасность** | `/account/security` | Центр безопасности: оценка, история входов, модули |
| **IP-адреса** | `/account/ip` | Управление IP allowlist для ограничения входа |

### Центр безопасности (Security Center)

Страница безопасности включает:

1. **Оценка безопасности** — 0–100 баллов с визуальным прогрессом
   - Email подтверждён: +25 баллов
   - IP-ограничения настроены: +25 баллов
   - Мало активных сессий (≤ 3): +10 баллов
   - 2FA включена: +10 баллов

2. **Статистика** — активные сессии, разрешённые IP, текущий IP

3. **Модули защиты** — список всех 10 модулей со статусами

4. **Параметры защиты** — конкретные лимиты и настройки

5. **История входов** — таблица с IP, устройством, датой, статусом

6. **Переключение между аккаунтами** — настройки безопасности при смене аккаунта:
   - **Всегда запрашивать пароль** — при любом переключении на этот аккаунт требуется пароль (максимальная защита)
   - **Только после долгого невхода** — переключение без пароля разрешено, если с последнего входа прошло меньше N дней (по умолчанию 180)

7. **Рекомендации** — советы по улучшению безопасности

### Управление IP-адресами

Пользователи могут самостоятельно:
- Просматривать список разрешённых IP
- Добавлять новые IP с меткой («Офис», «Дом», «VPN»)
- Добавлять текущий IP одним кликом
- Удалять IP из списка
- Видеть статус ограничения (включено/отключено)

> **Важно:** Если в списке есть хотя бы один IP, вход разрешён **только** с указанных адресов. Если список пуст — вход разрешён отовсюду.

---

## API: Полный справочник

### Аутентификация

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/uam/v1/check-email` | Проверка существования аккаунта: `{email}` → `{exists, email}` (v1.4.0) |
| POST | `/api/uam/v1/register` | Регистрация: `{email, password, display_name, company_name}` |
| POST | `/api/uam/v1/login` | Вход: `{email, password}` → Set-Cookie + в ответе `switch_token`, `require_password_on_switch`, `switch_inactivity_days` (сохранять в wsid_accounts) |
| POST | `/api/uam/v1/switch-with-token` | Переключение без пароля: `{email, switch_token}` → Set-Cookie; 403 `reason: 'password_required'` если нужен пароль (см. логику выше) |
| POST | `/api/uam/v1/logout` | Выход: удаление cookie + поддержка `return_url` (redirect для не-AJAX) |
| GET | `/api/uam/v1/logout` | Выход через redirect-ссылку: `?return_url=...` (для PHP/HTML интеграций) |
| POST | `/api/uam/v1/logout-all` | Выход из всех устройств: `{keep_current?: bool}` |
| GET | `/api/uam/v1/me` | Текущий пользователь (требует cookie) |
| GET | `/api/uam/v1/session/validate` | Валидация сессии (для backend-модулей) |

### Профиль и пароль

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| PATCH | `/api/uam/v1/profile` | Обновление профиля: `{display_name}` |
| POST | `/api/uam/v1/change-password` | Смена пароля: `{current_password, new_password, logout_all?}` + conditional captcha |
| POST | `/api/uam/v1/verify-email` | Подтверждение email по токену: `{token}` |

### Сессии

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/uam/v1/sessions` | Список активных сессий (включая `device_label`) |
| PATCH | `/api/uam/v1/sessions/:id` | Обновить метку устройства: `{device_label}` |
| DELETE | `/api/uam/v1/sessions/:id` | Отзыв конкретной сессии |

### IP Allowlist

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/uam/v1/ip-allowlist` | Список разрешённых IP + `current_ip`, `ip_restriction_enabled` |
| POST | `/api/uam/v1/ip-allowlist` | Добавить IP: `{ip_address, label}` |
| DELETE | `/api/uam/v1/ip-allowlist/:id` | Удалить IP из списка |
| POST | `/api/uam/v1/ip-allowlist/add-current` | Добавить текущий IP клиента |

### Безопасность (v1.3.0)

| Метод | Эндпоинт | Auth | Описание |
|-------|----------|------|----------|
| GET | `/api/uam/v1/security/status` | Cookie | Полный статус безопасности аккаунта (включая `security_settings`: `require_password_on_switch`, `switch_inactivity_days`) |
| PATCH | `/api/uam/v1/security/settings` | Cookie | Настройки переключения: `{require_password_on_switch?, switch_inactivity_days?}` |
| GET | `/api/uam/v1/security/login-history` | Cookie | История входов пользователя |
| GET | `/api/uam/v1/security/protection-info` | Публичный | Информация о модулях защиты + IP-статус |

### Согласия

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/uam/v1/consents` | Список согласий текущего пользователя |
| POST | `/api/uam/v1/consents` | Управление согласиями: `{scope, project_id?, grant: true/false}` |

### Проекты

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/uam/v1/projects` | Список подключённых проектов |
| POST | `/api/uam/v1/projects/:project_id/link` | Привязка проекта к UAM (platform_admin) |

### Health Check

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/health` | Статус сервиса, БД, сессий, модулей защиты |

**Ответ `/health` (v1.3.0):**
```json
{
  "status": "ok",
  "service": "waysenid-uam",
  "version": "1.3.0",
  "timestamp": "2026-02-08T12:00:00Z",
  "postgres": true,
  "session": true,
  "uptime": 86400,
  "security_modules": {
    "brute_force": true,
    "rate_limiter": true,
    "ip_filter": true,
    "audit_log": true
  }
}
```

### Ответ `/security/status`

```json
{
  "score": 75,
  "modules": {
    "brute_force": { "status": "active", "max_attempts": 10, "window_minutes": 30 },
    "rate_limiter": { "status": "active", "max_requests_per_minute": 120 },
    "ip_allowlist": { "status": "active", "count": 2 },
    "audit_log": { "status": "active" },
    "https": { "status": "active" },
    "password_policy": { "status": "active", "min_length": 8 }
  },
  "stats": {
    "active_sessions": 3,
    "allowed_ips": 2,
    "failed_attempts_24h": 5,
    "total_attempts": 150,
    "unique_ips": 12,
    "blocked_ips": 1
  },
  "login_history": [...]
}
```

### Ответ `/security/protection-info` (публичный)

```json
{
  "protection_enabled": true,
  "modules": [
    { "name": "Brute-Force Protection", "status": "active" },
    { "name": "DDoS Rate Limiter", "status": "active" },
    { "name": "IP Auto-Block", "status": "active" },
    { "name": "HTTPS Enforcement", "status": "active" }
  ],
  "limits": {
    "max_login_attempts": 10,
    "lockout_window_minutes": 30,
    "rate_limit_per_minute": 120
  }
}
```

---

## Требования CSP (Content Security Policy) для модулей

> **КРИТИЧЕСКИ ВАЖНО:** Если ваш модуль/приложение использует CSP, вы **обязаны** добавить
> `https://auth.markbase.ru` в директиву `connect-src`. Без этого вход НЕ будет работать.

### Проблема

Если приложение на `app.markbase.ru` пытается вызвать API `auth.markbase.ru` напрямую (например, `/check-email`, `/login`), но CSP не разрешает `auth.markbase.ru` в `connect-src`, браузер **блокирует** запросы:

```
Connecting to 'https://auth.markbase.ru/api/uam/v1/login' violates the following
Content Security Policy directive: "connect-src 'self' https://markbase.ru ..."
```

### Два способа решения

**Способ 1 (Рекомендуемый): Redirect-flow — НЕ вызываем API напрямую**

Модуль **не** встраивает свою форму входа. Вместо этого перенаправляет пользователя на `auth.markbase.ru`:

```javascript
// Пользователь не авторизован → redirect на auth
window.location.href = 'https://auth.markbase.ru/login?return_url=' +
  encodeURIComponent(window.location.href);
```

При таком подходе CSP **не нужен** для `auth.markbase.ru`, потому что запросы идут внутри `auth.markbase.ru` (same-origin).

**Способ 2: API-flow — вызываем API напрямую (для SPA/мобильных)**

Если ваш модуль вызывает `auth.markbase.ru` API напрямую (fetch/axios), добавьте в CSP:

```
connect-src 'self' https://auth.markbase.ru https://captcha.markbase.ru ...
```

### Где настроить CSP

| Место | Пример |
|-------|--------|
| **Nginx** (рекомендуется) | `add_header Content-Security-Policy "connect-src 'self' https://auth.markbase.ru ..." always;` |
| **HTML meta tag** | `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https://auth.markbase.ru ...">` |
| **Backend (helmet.js)** | `helmet({ contentSecurityPolicy: { directives: { connectSrc: ["'self'", "https://auth.markbase.ru"] } } })` |

### Минимальный CSP для модулей MarkBase

Полный справочник по CSP, Permissions-Policy и типичным ошибкам: **[PUBLIC/CSP_AND_SECURITY.md](../../CSP_AND_SECURITY.md)**.

Минимальный набор директив:

```
default-src 'self';
connect-src 'self' https://auth.markbase.ru https://captcha.markbase.ru https://api.markbase.ru;
script-src 'self' https://captcha.markbase.ru https://smartcaptcha.yandexcloud.net;
frame-src https://captcha.markbase.ru https://smartcaptcha.yandexcloud.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
```

При использовании Google Tag Manager добавьте в `script-src` и `frame-src`: `https://www.googletagmanager.com`. Для SmartCaptcha добавьте Permissions-Policy с `accelerometer` и `gyroscope` — см. CSP_AND_SECURITY.md.

> **Важно для app.markbase.ru:** Если приложение использует CSP и показывает «Network Error» при входе — это CSP блокирует запросы к `auth.markbase.ru`. Добавьте `https://auth.markbase.ru` в `connect-src`.

**Проблемы входа, сессий и CORS** при подключении внешних проектов (app, shop, сторонние сайты) к UAM, и что настроить на стороне внешнего проекта (CSP, credentials, return_url): [MARKBASE_PLUGINS_OUR_SIDE.md](../../MARKBASE_PLUGINS_OUR_SIDE.md).

---

## Пошаговое подключение (Quick Start)

### Шаг 1. Определите тип вашего проекта

| Тип | Домен | Cookie работает? | Метод |
|-----|-------|-----------------|-------|
| **Поддомен MarkBase** | `*.markbase.ru` | Автоматически | Redirect-flow |
| **Поддомен WayGPT** | `*.waygpt.ru` | Нет | API-flow или Redirect-flow |
| **Внешний проект** | `yoursite.com` | Нет | API-flow или Redirect-flow |

### Шаг 2. Redirect-flow (рекомендуется)

Подходит для **любого** проекта, включая внешние.

**2.1. Добавьте кнопки входа/регистрации:**
```html
<a href="https://auth.markbase.ru/login?return_url=https://yoursite.com/dashboard">
  Войти через MarkBase
</a>
<a href="https://auth.markbase.ru/register?return_url=https://yoursite.com/dashboard">
  Зарегистрироваться
</a>
```

**2.2. Добавьте ваш домен в allowlist:**

Администратор должен добавить ваш домен в `UAM_RETURN_URL_ALLOWLIST`:
```
UAM_RETURN_URL_ALLOWLIST=.markbase.ru,.waygpt.ru,.yoursite.com
```
Без этого `return_url` на ваш домен будет отклонён.

**2.3. Добавьте ваш домен в CORS:**

В `.env` UAM:
```
UAM_CORS_ORIGINS=https://app.markbase.ru,...,https://yoursite.com
```

**2.4. Валидация сессии на вашем backend:**

После редиректа обратно cookie `uam_session` будет установлена **только** для `*.markbase.ru`.

Для поддоменов MarkBase: cookie автоматически отправляется при запросах к UAM.

Для внешних проектов: ваш backend должен извлечь cookie из redirect-URL или использовать `/api/uam/v1/me` с `credentials: 'include'` (если пользователь открыл ваш сайт с cookie MarkBase в браузере).

**2.5. Добавьте валидацию в ваш backend:**

Скопируйте код из секции интеграции (JS/Python/PHP ниже) и настройте:

| Переменная | Внутри ядра (waysen_core стек) | Внешний проект (другой Docker/сервер) |
|-----------|-------------------------------|---------------------------------------|
| `UAM_INTERNAL` | `http://uam:8060` (Docker-имя) | `https://auth.markbase.ru` (публичный URL) |
| `UAM_PUBLIC` | `https://auth.markbase.ru` | `https://auth.markbase.ru` |

### Шаг 3. API-flow (для мобильных/SPA без redirect)

Если redirect не подходит (мобильное приложение, SPA на другом домене):

```
1. Ваш frontend → POST https://auth.markbase.ru/api/uam/v1/login
   Body: { "email": "...", "password": "..." }
   Headers: { "Content-Type": "application/json" }

2. Ответ: { "success": true, "user": {...} }
   + Set-Cookie: uam_session=... (Domain: .markbase.ru)

3. Для последующих запросов к UAM API:
   fetch('https://auth.markbase.ru/api/uam/v1/me', { credentials: 'include' })
```

> **Важно**: `credentials: 'include'` обязателен для отправки cookie cross-origin.

> **Важно**: При превышении лимита попыток ответ будет 429 с `retry_after_minutes`.

### Шаг 4. Проверьте интеграцию

```bash
# 1. Проверить что UAM доступен и модули защиты активны
curl -s https://auth.markbase.ru/health | jq .

# 2. Проверить информацию о защите (публичный эндпоинт)
curl -s https://auth.markbase.ru/api/uam/v1/security/protection-info | jq .

# 3. Зарегистрировать тестового пользователя
curl -s -X POST https://auth.markbase.ru/api/uam/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yoursite.com","password":"TestPass123","display_name":"Тест"}' | jq .

# 4. Войти и получить cookie
curl -s -X POST https://auth.markbase.ru/api/uam/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yoursite.com","password":"TestPass123"}' \
  -c cookies.txt | jq .

# 5. Проверить сессию
curl -s https://auth.markbase.ru/api/uam/v1/me -b cookies.txt | jq .

# 6. Проверить статус безопасности
curl -s https://auth.markbase.ru/api/uam/v1/security/status -b cookies.txt | jq .

# 7. Валидация сессии (как это делает ваш backend)
curl -s https://auth.markbase.ru/api/uam/v1/session/validate -b cookies.txt | jq .
```

### Шаг 5. Настройте кэш (обязательно!)

Без кэша каждый запрос пользователя дёргает UAM. С кэшем:
- Производительность: ~0ms вместо ~50ms на каждый запрос
- Отказоустойчивость: пользователи не вылетят при сбое UAM

Скопируйте готовый код из секции интеграции ниже — кэш уже встроен.

---

## 1. Интеграция: JavaScript / React

### Кнопки входа и регистрации

```javascript
const UAM_URL = 'https://auth.markbase.ru';

function AuthButtons() {
  const returnUrl = encodeURIComponent(window.location.origin + '/dashboard');
  return (
    <div>
      <a href={`${UAM_URL}/login?return_url=${returnUrl}`}>
        Войти через MarkBase
      </a>
      <a href={`${UAM_URL}/register?return_url=${returnUrl}`}>
        Зарегистрироваться
      </a>
    </div>
  );
}
```

> **return_url** передаётся одинаково для `/login` и `/register`. После успешного входа/регистрации
> пользователь автоматически вернётся на указанный URL с установленной cookie.

### Кнопка выхода

```javascript
function LogoutButton() {
  const handleLogout = async () => {
    // 1. Вызываем logout API (удаляет cookie на .markbase.ru)
    await fetch('https://auth.markbase.ru/api/uam/v1/logout', {
      method: 'POST',
      credentials: 'include'
    });
    // 2. Перенаправляем на главную
    window.location.href = '/';
  };

  return <button onClick={handleLogout}>Выйти</button>;
}

// Или просто ссылка:
// <a href="https://auth.markbase.ru/api/uam/v1/logout?return_url=https://yoursite.com">Выйти</a>
```

### Проверка сессии (Frontend)

```javascript
// После редиректа обратно — cookie уже установлена
async function checkAuth() {
  try {
    const resp = await fetch('https://auth.markbase.ru/api/uam/v1/me', {
      credentials: 'include'  // ОБЯЗАТЕЛЬНО для отправки cookies
    });
    if (resp.ok) {
      const user = await resp.json();
      console.log('Authenticated:', user.email, user.role);
      return user;
    }
  } catch (e) {}
  return null;
}
```

### Валидация на Backend (Node.js) — с кэшем

```javascript
const axios = require('axios');
const crypto = require('crypto');

// Внутри ядра (waysen_core стек): http://uam:8060 (Docker-имя)
// Из внешнего проекта (другой Docker/сервер): https://auth.markbase.ru
const UAM_INTERNAL = 'https://auth.markbase.ru';

// ── Session cache (in-memory) ──
const sessionCache = new Map();
const CACHE_TTL = 72 * 60 * 60 * 1000;  // 72 часа — совпадает с TTL сессии
const CACHE_REFRESH = 60_000;           // 1 мин — фоновое обновление
const CACHE_MAX = 10_000;

function cacheKey(cookie) {
  return crypto.createHash('sha256').update(cookie).digest('hex').slice(0, 32);
}

function cacheGet(cookie) {
  const key = cacheKey(cookie);
  const entry = sessionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    sessionCache.delete(key);
    return null;
  }
  return entry;
}

function cacheSet(cookie, user) {
  if (sessionCache.size >= CACHE_MAX) {
    // Удаляем протухшие
    const now = Date.now();
    for (const [k, v] of sessionCache) {
      if (now - v.cachedAt > CACHE_TTL) sessionCache.delete(k);
    }
  }
  sessionCache.set(cacheKey(cookie), { user, cachedAt: Date.now() });
}

function cacheRemove(cookie) {
  sessionCache.delete(cacheKey(cookie));
}

/**
 * Валидация сессии с максимальной отказоустойчивостью:
 * - UAM 200 → кэш + return user
 * - UAM 401 reason=revoked → ЯВНЫЙ отзыв → удаляем кэш
 * - UAM 401 другое → wipe/рестарт → используем кэш (не выкидываем!)
 * - UAM недоступен → используем кэш
 */
async function validateSession(req) {
  const cookie = req.cookies?.uam_session;
  if (!cookie) return null;

  const cached = cacheGet(cookie);

  // Кэш свежий — не дёргаем UAM
  if (cached && Date.now() - cached.cachedAt < CACHE_REFRESH) {
    return cached.user;
  }

  try {
    const { data, status } = await axios.get(
      `${UAM_INTERNAL}/api/uam/v1/session/validate`,
      {
        headers: { Cookie: `uam_session=${cookie}` },
        timeout: 3000,
        validateStatus: () => true
      }
    );

    if (status === 200) {
      cacheSet(cookie, data);
      return data;
    }

    if (status === 401) {
      // ТОЛЬКО reason=revoked означает что пользователь САМ отозвал сессию
      if (data?.reason === 'revoked') {
        cacheRemove(cookie);
        return null;
      }
      // not_found, expired — возможно wipe/рестарт, НЕ выкидываем
      return cached ? cached.user : null;
    }

    // 500, 503 — используем кэш
    return cached ? cached.user : null;
  } catch {
    // Timeout, connection refused — используем кэш
    return cached ? cached.user : null;
  }
}

// Express middleware
function requireAuth(req, res, next) {
  validateSession(req).then(user => {
    if (!user) return res.redirect('https://auth.markbase.ru/login?return_url=' + encodeURIComponent(req.originalUrl));
    req.user = user;
    next();
  });
}
```

---

## 2. Интеграция: Python / FastAPI — с кэшем

```python
import time
import hashlib
import httpx
from fastapi import Request, HTTPException

# Внутри ядра (waysen_core стек): "http://uam:8060"
# Из внешнего проекта (другой Docker/сервер): "https://auth.markbase.ru"
UAM_INTERNAL = "https://auth.markbase.ru"
UAM_PUBLIC = "https://auth.markbase.ru"
COOKIE = "uam_session"

# ── Session cache ──
_cache: dict = {}
CACHE_TTL = 259200    # 72 часа — совпадает с TTL сессии
CACHE_REFRESH = 60    # 1 мин — фоновое обновление
CACHE_MAX = 10000

def _key(cookie): return hashlib.sha256(cookie.encode()).hexdigest()[:32]

def _cache_get(cookie):
    entry = _cache.get(_key(cookie))
    if not entry: return None
    if time.time() - entry["t"] > CACHE_TTL:
        _cache.pop(_key(cookie), None)
        return None
    return entry

def _cache_set(cookie, user):
    if len(_cache) >= CACHE_MAX:
        now = time.time()
        for k in [k for k,v in _cache.items() if now-v["t"] > CACHE_TTL]:
            _cache.pop(k, None)
    _cache[_key(cookie)] = {"user": user, "t": time.time()}

def _cache_rm(cookie):
    _cache.pop(_key(cookie), None)

def validate_session(request: Request):
    cookie = request.cookies.get(COOKIE)
    if not cookie: return None

    cached = _cache_get(cookie)
    if cached and time.time() - cached["t"] < CACHE_REFRESH:
        return cached["user"]

    try:
        resp = httpx.get(
            f"{UAM_INTERNAL}/api/uam/v1/session/validate",
            cookies={COOKIE: cookie}, timeout=3
        )
        if resp.status_code == 200:
            user = resp.json()
            _cache_set(cookie, user)
            return user
        if resp.status_code == 401:
            # Только reason=revoked — пользователь ЯВНО отозвал
            reason = ""
            try: reason = resp.json().get("reason", "")
            except: pass
            if reason == "revoked":
                _cache_rm(cookie)
                return None
            # not_found/expired — wipe/рестарт, НЕ выкидываем
            return cached["user"] if cached else None
        return cached["user"] if cached else None
    except:
        return cached["user"] if cached else None

def require_auth(request: Request, return_url: str):
    user = validate_session(request)
    if not user:
        raise HTTPException(302, headers={
            "Location": f"{UAM_PUBLIC}/login?return_url={return_url}"
        })
    return user
```

---

## 3. Интеграция: PHP — с кэшем

```php
<?php
define('UAM_URL', 'https://auth.markbase.ru');
define('UAM_COOKIE', 'uam_session');
define('UAM_CACHE_TTL', 259200);    // 72 часа — совпадает с TTL сессии
define('UAM_CACHE_REFRESH', 60);    // 1 мин — фоновое обновление

/**
 * Получить путь к файлу кэша сессии.
 * Для PHP используется файловый кэш в /tmp.
 */
function uam_cache_path(string $cookie): string {
    $hash = substr(hash('sha256', $cookie), 0, 32);
    return sys_get_temp_dir() . '/uam_session_' . $hash . '.json';
}

function uam_cache_get(string $cookie): ?array {
    $path = uam_cache_path($cookie);
    if (!file_exists($path)) return null;
    $data = json_decode(file_get_contents($path), true);
    if (!$data || (time() - $data['cached_at']) > UAM_CACHE_TTL) {
        @unlink($path);
        return null;
    }
    return $data;
}

function uam_cache_set(string $cookie, array $user): void {
    $path = uam_cache_path($cookie);
    file_put_contents($path, json_encode([
        'user' => $user,
        'cached_at' => time()
    ]), LOCK_EX);
}

function uam_cache_remove(string $cookie): void {
    @unlink(uam_cache_path($cookie));
}

/**
 * Валидация сессии с graceful degradation.
 * При недоступности UAM возвращает закэшированный результат.
 */
function uam_validate_session(): ?array {
    $cookie = $_COOKIE[UAM_COOKIE] ?? null;
    if (!$cookie) return null;

    $cached = uam_cache_get($cookie);

    // Кэш свежий — не дёргаем UAM
    if ($cached && (time() - $cached['cached_at']) < UAM_CACHE_REFRESH) {
        return $cached['user'];
    }

    $ch = curl_init(UAM_URL . '/api/uam/v1/session/validate');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Cookie: " . UAM_COOKIE . "=" . $cookie],
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 2
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_errno($ch);
    curl_close($ch);

    // Timeout или ошибка соединения — используем кэш
    if ($error) {
        return $cached ? $cached['user'] : null;
    }

    if ($code === 200) {
        $user = json_decode($response, true);
        uam_cache_set($cookie, $user);
        return $user;
    }

    if ($code === 401) {
        // Только reason=revoked → пользователь ЯВНО отозвал сессию
        $body = json_decode($response, true);
        if (($body['reason'] ?? '') === 'revoked') {
            uam_cache_remove($cookie);
            return null;
        }
        // not_found/expired — wipe/рестарт, НЕ выкидываем
        return $cached ? $cached['user'] : null;
    }

    // 500, 503 — используем кэш
    return $cached ? $cached['user'] : null;
}

function uam_require_auth(string $return_url): array {
    $user = uam_validate_session();
    if (!$user) {
        header('Location: ' . UAM_URL . '/login?return_url=' . urlencode($return_url));
        exit;
    }
    return $user;
}

function uam_login_url(string $return_url): string {
    return UAM_URL . '/login?return_url=' . urlencode($return_url);
}

function uam_register_url(string $return_url): string {
    return UAM_URL . '/register?return_url=' . urlencode($return_url);
}

function uam_logout_url(string $return_url): string {
    return UAM_URL . '/api/uam/v1/logout?return_url=' . urlencode($return_url);
}
```

**Использование в шаблоне:**
```php
<?php
$return = 'https://' . $_SERVER['HTTP_HOST'] . '/dashboard';
$user = uam_validate_session();

if ($user) {
    echo "Привет, {$user['display_name']}! ";
    echo "<a href='" . uam_logout_url($return) . "'>Выйти</a>";
} else {
    echo "<a href='" . uam_login_url($return) . "'>Войти</a> | ";
    echo "<a href='" . uam_register_url($return) . "'>Регистрация</a>";
}
?>
```

---

## 4. Интеграция: WordPress — с кэшем

### Файл плагина: `markbase-auth.php`

```php
<?php
/**
 * Plugin Name: MarkBase Auth (WaySenID)
 * Description: Единая аутентификация через MarkBase UAM с отказоустойчивым кэшем
 * Version: 1.2.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_UAM_URL', 'https://auth.markbase.ru');
define('MB_UAM_COOKIE', 'uam_session');
define('MB_CACHE_TTL', 259200);    // 72 часа — совпадает с TTL сессии
define('MB_CACHE_REFRESH', 60);    // 1 мин — фоновое обновление

// === Кэш (WordPress Transients API) ===

function mb_auth_cache_key(string $cookie): string {
    return 'mb_uam_' . substr(hash('sha256', $cookie), 0, 20);
}

function mb_auth_cache_get(string $cookie): ?array {
    $data = get_transient(mb_auth_cache_key($cookie));
    return is_array($data) ? $data : null;
}

function mb_auth_cache_set(string $cookie, array $user): void {
    set_transient(mb_auth_cache_key($cookie), [
        'user' => $user,
        'cached_at' => time()
    ], MB_CACHE_TTL);
}

function mb_auth_cache_remove(string $cookie): void {
    delete_transient(mb_auth_cache_key($cookie));
}

// === Валидация сессии UAM с graceful degradation ===
function mb_auth_validate_session(): ?array {
    $cookie = $_COOKIE[MB_UAM_COOKIE] ?? null;
    if (!$cookie) return null;

    $cached = mb_auth_cache_get($cookie);

    // Кэш свежий — не дёргаем UAM
    if ($cached && (time() - $cached['cached_at']) < MB_CACHE_REFRESH) {
        return $cached['user'];
    }

    $response = wp_remote_get(MB_UAM_URL . '/api/uam/v1/session/validate', [
        'cookies' => [new WP_Http_Cookie([
            'name' => MB_UAM_COOKIE,
            'value' => $cookie
        ])],
        'timeout' => 3
    ]);

    // UAM недоступен — используем кэш
    if (is_wp_error($response)) {
        return $cached ? $cached['user'] : null;
    }

    $code = wp_remote_retrieve_response_code($response);

    if ($code === 200) {
        $user = json_decode(wp_remote_retrieve_body($response), true);
        mb_auth_cache_set($cookie, $user);
        return $user;
    }

    if ($code === 401) {
        // Только reason=revoked → пользователь ЯВНО отозвал сессию
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (($body['reason'] ?? '') === 'revoked') {
            mb_auth_cache_remove($cookie);
            return null;
        }
        // not_found/expired — wipe/рестарт, НЕ выкидываем
        return $cached ? $cached['user'] : null;
    }

    // 500, 503 — используем кэш
    return $cached ? $cached['user'] : null;
}

// === Автоматический логин WordPress через UAM ===
add_action('init', function() {
    if (is_user_logged_in()) return;

    $uam_user = mb_auth_validate_session();
    if (!$uam_user) return;

    // Найти или создать WP-пользователя
    $wp_user = get_user_by('email', $uam_user['email']);
    if (!$wp_user) {
        $user_id = wp_create_user(
            $uam_user['email'],
            wp_generate_password(),
            $uam_user['email']
        );
        wp_update_user([
            'ID' => $user_id,
            'display_name' => $uam_user['display_name'] ?? $uam_user['email'],
            'role' => mb_auth_map_role($uam_user['role'] ?? 'user')
        ]);
        $wp_user = get_user_by('id', $user_id);
    }

    // Автоматический логин
    wp_set_current_user($wp_user->ID);
    wp_set_auth_cookie($wp_user->ID);
});

// === Маппинг ролей UAM -> WordPress ===
function mb_auth_map_role($uam_role) {
    $map = [
        'platform_admin' => 'administrator',
        'owner'          => 'administrator',
        'admin'          => 'editor',
        'manager'        => 'author',
        'operator'       => 'contributor',
        'user'           => 'subscriber'
    ];
    return $map[$uam_role] ?? 'subscriber';
}

// === Кнопки входа и регистрации (шорткоды) ===
add_shortcode('markbase_login', function($atts) {
    $atts = shortcode_atts(['text' => 'Войти через MarkBase'], $atts);
    $return_url = urlencode(home_url($_SERVER['REQUEST_URI']));
    return '<a href="' . MB_UAM_URL . '/login?return_url=' . $return_url
         . '" class="markbase-login-btn">' . esc_html($atts['text']) . '</a>';
});

add_shortcode('markbase_register', function($atts) {
    $atts = shortcode_atts(['text' => 'Зарегистрироваться'], $atts);
    $return_url = urlencode(home_url($_SERVER['REQUEST_URI']));
    return '<a href="' . MB_UAM_URL . '/register?return_url=' . $return_url
         . '" class="markbase-register-btn">' . esc_html($atts['text']) . '</a>';
});

// === Полный виджет авторизации (шорткод) ===
add_shortcode('markbase_auth', function($atts) {
    $user = mb_auth_validate_session();
    $return_url = urlencode(home_url($_SERVER['REQUEST_URI']));
    if ($user) {
        $name = esc_html($user['display_name'] ?? $user['email']);
        $logout = MB_UAM_URL . '/api/uam/v1/logout?return_url=' . $return_url;
        return "<span class='mb-auth-user'>Привет, {$name}! <a href='{$logout}'>Выйти</a></span>";
    }
    $login = MB_UAM_URL . '/login?return_url=' . $return_url;
    $register = MB_UAM_URL . '/register?return_url=' . $return_url;
    return "<span class='mb-auth-guest'><a href='{$login}'>Войти</a> | <a href='{$register}'>Регистрация</a></span>";
});

// === Logout — очистка UAM cookie ===
add_action('wp_logout', function() {
    setcookie(MB_UAM_COOKIE, '', time() - 3600, '/', '.markbase.ru');
});

// === Страница настроек ===
add_action('admin_menu', function() {
    add_options_page('MarkBase Auth', 'MarkBase Auth', 'manage_options', 'markbase-auth', function() {
        $user = mb_auth_validate_session();
        echo '<div class="wrap">';
        echo '<h1>MarkBase Auth (WaySenID)</h1>';
        echo '<table class="form-table">';
        echo '<tr><th>UAM URL</th><td>' . MB_UAM_URL . '</td></tr>';
        echo '<tr><th>Cookie</th><td>' . MB_UAM_COOKIE . '</td></tr>';
        echo '<tr><th>Cache TTL</th><td>' . MB_CACHE_TTL . ' сек (72ч, совпадает с TTL сессии)</td></tr>';
        echo '<tr><th>Session</th><td>' . ($user ? 'Active (' . $user['email'] . ')' : 'Not connected') . '</td></tr>';
        echo '</table></div>';
    });
});
```

### Установка WordPress-плагина

1. Скопируйте `markbase-auth.php` в `/wp-content/plugins/markbase-auth/`
2. Активируйте в **Плагины → MarkBase Auth**
3. Используйте шорткоды:
   - `[markbase_login]` — кнопка входа
   - `[markbase_register]` — кнопка регистрации
   - `[markbase_auth]` — полный виджет (если залогинен — имя + выход, иначе — вход + регистрация)
4. Настройте в **Настройки → MarkBase Auth** — проверьте статус подключения

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `UAM_URL` | `https://auth.markbase.ru` | Публичный URL |
| `UAM_INTERNAL` | `http://uam:8060` | Внутри ядра (waysen_core стек). Из внешнего проекта: `https://auth.markbase.ru` |
| `UAM_SESSION_COOKIE` | `uam_session` | Имя cookie |
| `UAM_COOKIE_DOMAIN` | `.markbase.ru` | Домен cookie |
| `UAM_SESSION_TTL_HOURS` | `72` | Время жизни сессии |
| `CACHE_TTL` | `259200` (72 часа) | Совпадает с TTL сессии |
| `CACHE_REFRESH` | `60` (1 мин) | Фоновое обновление |

---

## FAQ

### Что произойдёт если UAM упадёт?

Пользователи, которые **уже вошли**, продолжат работу в любом модуле. Их сессия закэширована локально (TTL = 72 часа, совпадает с TTL самой сессии). Новые пользователи не смогут войти до восстановления UAM.

### Что произойдёт при `--wipe` (полный сброс БД)?

Залогиненные пользователи **не заметят** — кэш на модулях продолжит работать. UAM вернёт `reason: "not_found"` (сессия отсутствует в свежей БД), но модули НЕ удалят кэш. Пользователь продолжает работу.

### Что произойдёт при "Выйти из всех устройств"?

UAM отметит все сессии как `revoked`. При следующей ревалидации (в течение 60 сек) модуль получит `reason: "revoked"` и **удалит кэш**, пользователь будет разлогинен. Это единственный способ принудительно разлогинить.

### Как обновить кэш при изменении роли пользователя?

Кэш обновляется каждую минуту при доступном UAM. Изменение роли применится автоматически в течение 60 секунд.

### Безопасен ли кэш?

Да. Ключ кэша — SHA256 от cookie (не сам cookie). Кэш инвалидируется **только** при явном `reason: "revoked"` от UAM. Это означает что пользователь сам нажал "выйти" или "сменить пароль с принудительным выходом".

### Как работает защита от перебора?

1. Каждая неудачная попытка входа записывается с IP и email
2. При достижении 10 попыток за 30 мин — вход блокируется
3. При повторном нарушении блокировка нарастает: 60 → 120 → 240 мин
4. IP автоматически заносится в таблицу `blocked_ips`
5. Пользователь видит оставшиеся попытки и таймер блокировки

### Как работает IP-фильтрация?

1. Пользователь добавляет доверенные IP в `/account/ip`
2. Если в списке ≥ 1 IP — вход разрешён **только** с них
3. При попытке входа с другого IP — отказ с сообщением
4. Если список пуст — вход разрешён отовсюду

---

## Changelog

### 1.5.0 (2026-02-09)
- **Переключение без пароля** — при переключении на другой сохранённый аккаунт пароль не запрашивается, если владелец аккаунта не включил «Всегда запрашивать пароль» и с последнего входа прошло меньше N дней (по умолчанию 180)
- **POST /switch-with-token** — переключение по токену, выданному при входе по паролю (TTL по умолчанию 30 дней)
- **Настройки в Безопасности** — «Переключение между аккаунтами»: всегда пароль / только после долгого невхода + число дней
- **Метки устройств** — в списке сессий можно задать название устройства (PATCH /sessions/:id, `device_label`)
- **Спецификация в плагине** — логика переключения, формат wsid_accounts (switch_token, настройки), чек-лист и готовый AccountSwitcher с безопасной логикой для сторонних модулей

### 1.4.0 (2026-02-09)
- **Account Switcher** — переключение аккаунтов в dropdown профиля шапки (Layout.js)
- **URL-параметр `?switch=email`** — быстрое переключение аккаунта (пропускает выбор, сразу ввод пароля)
- **URL-параметр `?new_account=1`** — добавление нового аккаунта (пропускает выбор, сразу ввод email)
- **GET /logout с return_url** — поддержка redirect-ссылок для выхода (PHP/WordPress/HTML)
- **POST /check-email** — новый endpoint для проверки существования аккаунта перед вводом пароля
- **Умный UX логина** — при несуществующем email показывается предложение зарегистрироваться (с автозаполнением email)
- **Умный UX регистрации** — при занятом email показывается предложение войти
- **Различение ошибок** — `reason: 'user_not_found'` (логин), `reason: 'email_taken'` (регистрация) для точного отображения на фронтенде
- **URL-параметр `?email=`** — бесшовный переход между логином и регистрацией с автозаполнением email
- **Спецификация Account Switcher для модулей** — полная документация + готовый React-компонент для любого модуля
- **Captcha fix** — исправлена двойная верификация (frontend больше не вызывает /verify напрямую)
- **Captcha URL** — динамическое определение URL captcha-сервиса (`https://captcha.markbase.ru` в продакшене)
- **Fail-open tokens** — корректная обработка `fail_open` токенов в backend middleware

### 1.3.0 (2026-02-08)
- 🎨 **Полный редизайн** frontend в стиле Yandex ID
- 🔒 **Многоуровневая защита**: brute-force, DDoS rate limiting, progressive lockout, IP auto-block
- 👤 **Выбор аккаунтов**: до 5 запомненных, удаление, переключение, аватары
- 🌐 **IP-управление**: добавление/удаление IP, текущий IP, метки
- 📊 **Центр безопасности**: оценка 0–100, модули защиты, параметры, история
- 📝 **История входов**: полная таблица с IP, устройством, датой, статусом
- 🛡️ **Password Policy**: минимум 8 символов, заглавные + строчные + цифры
- 🔐 **Security Headers**: HSTS, X-Frame-Options, X-XSS-Protection, no-cache
- 📡 **Новые API**: `/security/status`, `/security/settings`, `/security/login-history`, `/security/protection-info`
- ⚡ **Global Rate Limiter**: 120 req/min на все API, 20 req/min на auth
- 🚫 **IP Auto-Block**: автоблокировка при повторных нарушениях с нарастающим lockout
- 📋 **Audit Logging**: полное логирование входов и действий безопасности
- 🔄 **Личный кабинет**: 6 страниц — Профиль, Сессии, Модули, Согласия, Безопасность, IP
- ✅ **Валидация регистрации**: чеклист требований к паролю в реальном времени

### 1.2.0 (2026-02-07)
- Reason-based invalidation: кэш удаляется ТОЛЬКО при `reason: "revoked"`
- Перезапуск/wipe UAM не влияет на залогиненных пользователей
- Cache TTL увеличен до 72 часов (совпадает с TTL сессии)
- Эндпоинт `/session/validate` теперь возвращает `reason` в 401-ответах

### 1.1.0 (2026-02-07)
- Session cache с graceful degradation
- При недоступности UAM пользователи остаются залогиненными
- Фоновое обновление кэша каждые 60 сек при доступном UAM
- Обновлены все примеры: JS, Python, PHP, WordPress

### 1.0.0 (2026-02-07)
- Первый релиз
- Session-based аутентификация (bcrypt + HTTP-only cookie)
- SSO через cookie на `.markbase.ru`
- CORS для `*.markbase.ru`, `*.waygpt.ru`
- Brute-force protection (10 попыток / 30 мин)
- IP allowlist для ограничения входа
- Выход из всех устройств
- Интеграция: JS, Python, PHP, WordPress

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

