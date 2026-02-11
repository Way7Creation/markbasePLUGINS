# WaySenID One Tap — Автоматическое предложение входа

> **Версия:** 1.0.0 | Аналог: Google One Tap, Yandex ID Auto

Когда пользователь уже залогинен в WaySenID (в любом модуле или сайте экосистемы),
при посещении стороннего сайта с подключённым WaySenID SDK — автоматически появляется
плавающий промпт **«Войти как Иван Петров»** с аватаром, без нажатия на кнопку.

---

## 1. Как это работает

### 1.1 Архитектура (cross-domain session detection)

Поскольку WaySenID (`auth.markbase.ru`) и сторонний сайт (`waygpt.ru`) на разных доменах,
cookie напрямую недоступны. Решение — **hidden iframe + postMessage**:

```
   waygpt.ru (страница)                          auth.markbase.ru
┌────────────────────────────────────┐
│                                    │
│  <script> WaySenID SDK </script>   │
│       │                            │
│       ▼                            │
│  ┌─────────────────────────┐       │       ┌──────────────────────────┐
│  │  <iframe hidden>        │───────────────►│  /sdk/session-probe      │
│  │  auth.markbase.ru/      │       │       │                          │
│  │  sdk/session-probe      │       │       │  Читает cookie           │
│  │                         │◄──────────────│  uam_session             │
│  │  postMessage({          │       │       │                          │
│  │    type: 'wsid:session',│       │       │  Если есть сессия:       │
│  │    status: 'active',    │       │       │  → {name, email, avatar} │
│  │    user: { ... }        │       │       │                          │
│  │  })                     │       │       │  Если нет:               │
│  └─────────────────────────┘       │       │  → {status: 'none'}      │
│       │                            │       └──────────────────────────┘
│       ▼                            │
│  ┌─────────────────────────────┐   │
│  │  One Tap Prompt             │   │
│  │  ┌──┐ Войти как             │   │
│  │  │ИП│ Иван Петров           │   │
│  │  └──┘ iv***@mail.ru         │   │
│  │       [Продолжить] [✕]      │   │
│  └─────────────────────────────┘   │
│                                    │
└────────────────────────────────────┘
```

### 1.2 Шаги

```
1. Пользователь открывает waygpt.ru
2. WaySenID SDK загружается и создаёт hidden iframe → auth.markbase.ru/sdk/session-probe
3. iframe читает cookie uam_session на домене auth.markbase.ru
4. Если сессия активна → iframe отправляет postMessage с данными пользователя
5. SDK получает данные и проверяет:
   a. Пользователь уже авторизован на waygpt.ru? → НЕ показывать промпт
   b. Пользователь ранее отклонил One Tap? → НЕ показывать (cooldown 24ч)
   c. Consent для waygpt.ru уже дан? → Показать «Войти как»
   d. Consent не дан? → Показать «Продолжить с WaySenID» (потребует consent)
6. Пользователь нажимает «Продолжить» → silent OAuth flow (prompt=none или consent)
7. SDK получает code → backend обменивает на token → пользователь авторизован
```

### 1.3 Когда промпт НЕ показывается

| Условие | Причина |
|---------|---------|
| Пользователь не залогинен в WaySenID | Нет сессии |
| Пользователь уже авторизован на этом сайте | Не нужно |
| Пользователь закрыл промпт (cooldown 24ч) | Не раздражать |
| `auto_sign_in: false` в настройках SDK | Разработчик отключил |
| Страница — iframe (не top-level) | Безопасность |
| Third-party cookies заблокированы | Технически невозможно |
| Мобильный — экран < 400px | UX (промпт мешает) |

---

## 2. UI: One Tap Prompt

### 2.1 Структура промпта

```
┌──────────────────────────────────────────────┐
│                                          [✕] │
│  ┌────┐                                     │
│  │ ИП │  Войти как                          │
│  │    │  Иван Петров                         │
│  └────┘  iv***@mail.ru                       │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │          Продолжить                   │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  🔒 Защищено WaySenID                       │
└──────────────────────────────────────────────┘
```

### 2.2 Позиционирование

| Позиция | Описание | Когда |
|---------|----------|-------|
| `top-right` | Правый верхний угол | По умолчанию |
| `top-left` | Левый верхний угол | Если справа занято |
| `bottom-right` | Правый нижний угол | Опционально |
| `center` | Модальный промпт по центру | При `mode: 'modal'` |
| `inline` | Встроенный в контейнер | При указании `container` |

### 2.3 Анимация появления

```css
/* Появление (slide-in + fade) */
@keyframes wsid-onetap-enter {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Задержка появления: 1.5 секунды после загрузки страницы */
/* (чтобы не отвлекать от основного контента) */
```

### 2.4 Дизайн-токены

| Свойство | Значение |
|----------|----------|
| Ширина | 340px |
| Скругление | 16px |
| Тень | `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)` |
| Фон | `#ffffff` |
| Паддинг | 20px |
| Шрифт | Inter |
| Аватар | 44px, круг, хеш-цвет |
| Кнопка «Продолжить» | `#0f172a`, full-width, 40px, border-radius 10px |
| Бейдж «Защищено» | font-size 11px, color #94a3b8, иконка lock |
| Кнопка закрытия (✕) | 28px, border-radius 50%, hover: #f1f5f9 |
| Z-index | `2147483647` (максимальный, поверх всего) |

### 2.5 CSS

```css
/* ═══ One Tap Prompt ═══ */
.wsid-onetap {
  position: fixed;
  z-index: 2147483647;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Позиционирование */
.wsid-onetap--top-right { top: 20px; right: 20px; }
.wsid-onetap--top-left { top: 20px; left: 20px; }
.wsid-onetap--bottom-right { bottom: 20px; right: 20px; }

.wsid-onetap__card {
  width: 340px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  padding: 20px;
  animation: wsid-onetap-enter 0.3s ease-out;
}

.wsid-onetap__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.15s;
}
.wsid-onetap__close:hover {
  background: #f1f5f9;
  color: #475569;
}

.wsid-onetap__user {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.wsid-onetap__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.wsid-onetap__name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.wsid-onetap__email {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 1px;
}

.wsid-onetap__label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 2px;
}

.wsid-onetap__btn {
  width: 100%;
  height: 40px;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}
.wsid-onetap__btn:hover {
  background: #1e293b;
  box-shadow: 0 4px 12px rgba(15,23,42,0.2);
}

.wsid-onetap__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 12px;
  font-size: 11px;
  color: #94a3b8;
}

/* Мобильная адаптация */
@media (max-width: 400px) {
  .wsid-onetap { display: none; }
}

@keyframes wsid-onetap-enter {
  from { opacity: 0; transform: translateY(-12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

---

## 3. SDK API: One Tap

### 3.1 Инициализация с One Tap

```javascript
WaySenID.init({
  client_id: 'wsid_app_waygpt_abc123',
  redirect_uri: 'https://waygpt.ru/auth/callback',
  scope: 'openid profile email',

  // ═══ One Tap настройки ═══
  one_tap: {
    enabled: true,                // Включить One Tap (default: true)
    auto_select: false,           // Автоматически войти без клика (default: false)
    position: 'top-right',        // Позиция: top-right | top-left | bottom-right
    delay: 1500,                  // Задержка появления, мс (default: 1500)
    cooldown: 86400,              // Кулдаун после закрытия, сек (default: 24ч)
    cancel_on_tap_outside: true,  // Закрыть при клике вне промпта

    // Callbacks
    onPromptShow: () => {
      console.log('One Tap prompt shown');
    },
    onPromptDismiss: (reason) => {
      // reason: 'user_closed' | 'auto_cancel' | 'timeout'
      console.log('One Tap dismissed:', reason);
    },
    onSuccess: async (response) => {
      // response.code — authorization code
      // response.user — { sub, name, email, picture }
      const resp = await fetch('/api/auth/wsid/onetap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: response.code }),
      });
      const data = await resp.json();
      if (data.success) {
        window.location.reload(); // или обновить UI
      }
    },
    onError: (error) => {
      console.error('One Tap error:', error);
    },
  }
});
```

### 3.2 Программное управление

```javascript
// Показать One Tap вручную
WaySenID.showOneTap();

// Скрыть One Tap
WaySenID.hideOneTap();

// Проверить, есть ли активная сессия WaySenID (без показа промпта)
const session = await WaySenID.checkSession();
// session = { active: true, user: { name, email, picture } }
// session = { active: false }

// Проверить, есть ли consent для данного client_id
const consent = await WaySenID.checkConsent();
// consent = { granted: true, scopes: ['openid', 'profile', 'email'] }
// consent = { granted: false }
```

### 3.3 Auto Select (вход без клика)

Если `auto_select: true` и выполнены ВСЕ условия:

| Условие | Описание |
|---------|----------|
| 1 активная сессия | Только 1 аккаунт WaySenID |
| Consent уже дан | Пользователь ранее разрешил этому сайту |
| Не было отклонений | Пользователь не закрывал промпт ранее |
| Медиатор разрешает | FedCM API (если поддерживается) |

Тогда SDK автоматически выполняет silent OAuth flow и вызывает `onSuccess` **без UI**.

```
Пользователь открывает waygpt.ru → SDK обнаруживает сессию →
→ consent уже дан → silent flow → авторизован автоматически
```

---

## 4. Session Probe Endpoint

### 4.1 Iframe endpoint

```
GET https://auth.markbase.ru/sdk/session-probe
```

Это HTML-страница, загружаемая в hidden iframe. Она:
1. Читает cookie `uam_session` (домен `auth.markbase.ru`)
2. Валидирует сессию
3. Отправляет `postMessage` в parent window

### 4.2 Формат postMessage

```javascript
// Есть активная сессия
{
  type: 'wsid:session_status',
  status: 'active',
  user: {
    sub: 'user_abc123',
    name: 'Иван Петров',
    email: 'ivan@example.com',
    email_masked: 'iv***@example.com',
    picture: null,
    initials: 'ИП',
    avatar_color: '#5B45FF'
  },
  consent: {
    granted: true,           // consent для данного client_id
    scopes: ['openid', 'profile', 'email']
  },
  session_age: 3600          // сколько секунд прошло с последнего входа
}

// Нет сессии
{
  type: 'wsid:session_status',
  status: 'none'
}

// Ошибка
{
  type: 'wsid:session_status',
  status: 'error',
  error: 'session_expired'
}
```

### 4.3 Безопасность iframe

| Механизм | Реализация |
|----------|------------|
| Origin whitelist | iframe отвечает только зарегистрированным доменам |
| Client ID validation | `client_id` передаётся в URL iframe, проверяется серверно |
| SameSite cookies | `uam_session` cookie: `SameSite=None; Secure` |
| CSP | `frame-ancestors` ограничен зарегистрированными доменами |
| Clickjacking | iframe полностью скрыт (`display:none`, `width:0`, `height:0`) |
| Rate limiting | Макс. 10 probe-запросов / минута с одного origin |
| Minimal data | Возвращает только name, masked email, avatar — не полные данные |

---

## 5. FedCM API (Federated Credential Management)

### 5.1 Что это

**FedCM** — это новый Web API (Chrome 108+, Edge 108+), который заменяет hidden iframe approach. Он позволяет браузеру нативно управлять федеративной авторизацией, обходя блокировку third-party cookies.

### 5.2 Поддержка

| Браузер | Поддержка | Fallback |
|---------|-----------|----------|
| Chrome 108+ | FedCM API | — |
| Edge 108+ | FedCM API | — |
| Firefox | В разработке | iframe probe |
| Safari | В разработке | iframe probe |
| Другие | Нет | iframe probe |

### 5.3 SDK автоматически выбирает лучший метод

```javascript
// SDK внутренне:
if (navigator.credentials && 'IdentityCredential' in window) {
  // Используем FedCM API
  useFedCM();
} else {
  // Fallback на iframe probe
  useIframeProbe();
}
```

### 5.4 FedCM endpoints (на стороне WaySenID)

```
/.well-known/web-identity                → Identity Provider config
/sdk/fedcm/config.json                   → FedCM provider config
/sdk/fedcm/accounts                      → Список аккаунтов пользователя
/sdk/fedcm/token                         → Получение ID token
/sdk/fedcm/client-metadata?client_id=... → Метаданные клиента
/sdk/fedcm/disconnect                    → Отключение
```

**config.json:**

```json
{
  "accounts_endpoint": "/sdk/fedcm/accounts",
  "client_metadata_endpoint": "/sdk/fedcm/client-metadata",
  "id_assertion_endpoint": "/sdk/fedcm/token",
  "disconnect_endpoint": "/sdk/fedcm/disconnect",
  "login_url": "/login",
  "branding": {
    "background_color": "#0f172a",
    "color": "#ffffff",
    "icons": [{
      "url": "https://auth.markbase.ru/branding/icon-512.png",
      "size": 512
    }]
  }
}
```

---

## 6. Множественные аккаунты

Если у пользователя несколько аккаунтов WaySenID:

### 6.1 One Tap с выбором

```
┌──────────────────────────────────────────────┐
│  Выберите аккаунт для waygpt.ru          [✕] │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ ┌──┐ Иван Петров                    │    │
│  │ │ИП│ iv***@mail.ru                   │    │
│  │ └──┘                                 │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ ┌──┐ Мария Сидорова                  │    │
│  │ │МС│ ma***@gmail.com                 │    │
│  │ └──┘                                 │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  + Другой аккаунт                            │
│                                              │
│  🔒 Защищено WaySenID                       │
└──────────────────────────────────────────────┘
```

### 6.2 Поведение

- 1 аккаунт → промпт «Войти как [Имя]» с кнопкой
- 2+ аккаунтов → промпт со списком аккаунтов
- 0 аккаунтов → промпт не показывается (пользователь кликнет кнопку сам)

---

## 7. Интеграция с существующими auth-системами сайта

### 7.1 Сценарий: сайт имеет свою систему регистрации

```javascript
WaySenID.init({
  client_id: 'wsid_app_waygpt_abc123',
  // ...

  one_tap: {
    enabled: true,
    onSuccess: async (response) => {
      // 1. Обменять code на token (backend)
      const { user: wsidUser } = await exchangeCode(response.code);

      // 2. Проверить — есть ли такой user в ВАШЕЙ БД?
      const localUser = await checkLocalUser(wsidUser.email);

      if (localUser) {
        // Пользователь уже есть → привязать WaySenID и войти
        await linkWsidAccount(localUser.id, wsidUser.sub);
        loginAs(localUser);
      } else {
        // Нового пользователя → предложить создать аккаунт
        // (или автоматически создать, если так настроено)
        showRegistrationPrompt({
          prefill: {
            email: wsidUser.email,
            name: wsidUser.name,
          },
          wsid_sub: wsidUser.sub,
          message: 'Для продолжения создайте аккаунт на WayGPT'
        });
      }
    }
  }
});
```

### 7.2 Автоматическая регистрация vs подтверждение

Разработчик настраивает поведение при новом пользователе:

```javascript
WaySenID.init({
  // ...
  one_tap: {
    new_user_action: 'auto_register',  // или 'confirm' или 'redirect'
    // 'auto_register' — автоматически создать аккаунт (email уже подтверждён WaySenID)
    // 'confirm'       — показать промпт «Создать аккаунт на WayGPT?»
    // 'redirect'      — перенаправить на свою страницу регистрации с prefill
  }
});
```

---

## 8. Аналитика и метрики

SDK собирает (анонимно) и отправляет в Dashboard разработчика:

| Метрика | Описание |
|---------|----------|
| `one_tap_shown` | Сколько раз показан промпт |
| `one_tap_success` | Сколько раз пользователь нажал «Продолжить» |
| `one_tap_dismissed` | Сколько раз закрыл промпт |
| `one_tap_auto_select` | Сколько автоматических входов (без UI) |
| `conversion_rate` | shown → success (%) |
| `session_probe_time` | Время обнаружения сессии (мс) |

---

## Changelog

### 2026-02-09
- **v1.0.0** — One Tap: session detection (iframe probe + FedCM), prompt UI, auto-select, multiple accounts, CSS, SDK API, аналитика
