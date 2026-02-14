# WaySenID — Войти через WaySenID

> **Версия:** 3.0.0 | **Slug:** `auth-widget` | **Категория:** Auth / SSO

Полная документация для интеграции авторизации **WaySenID** в ваш проект.
Аналог кнопок «Войти через Google», «Войти через Яндекс» — для экосистемы MarkBase.

---

## Файлы документации

| Файл | Описание |
|------|----------|
| **README.md** (этот файл) | Обзор, кнопка, OAuth endpoints, SDK, UI-компоненты |
| **[INTEGRATION.md](./INTEGRATION.md)** | Полное руководство: lifecycle, backend-код, схема БД, безопасность |
| **[ONETAP.md](./ONETAP.md)** | One Tap — автоматическое предложение входа, session detection |
| **[WAYSENID_LOGIN_AS.md](../WAYSENID_LOGIN_AS.md)** | Подключение как модуль: проект с **собственной регистрацией** — одна кнопка «Войти как», передача данных (cookie / wsid_code) |
| **[waysenid.css](./waysenid.css)** | Ready-to-use CSS для кнопки и формы (CDN / npm) |
| **[plugin.json](./plugin.json)** | Метаданные спецификации |

---

## 1. Обзор

**WaySenID** — единый провайдер аутентификации платформы MarkBase.
Любой сервис (внутренний модуль или сторонний сайт) может добавить кнопку **«Войти через WaySenID»** и получить доступ к данным пользователя через стандартный OAuth 2.0 + OIDC flow.

### 1.1 Как это работает

```
   Ваш сервис (waygpt.ru)              WaySenID (auth.markbase.ru)
┌─────────────────────────┐         ┌─────────────────────────────┐
│                         │         │                             │
│  [Войти через WaySenID] │ ──────► │  У пользователя есть        │
│                         │         │  аккаунт?                   │
│  ───── или ─────        │         │                             │
│                         │         │  ДА → Account Picker /      │
│  Email: [________]      │         │       Login                  │
│  Пароль: [________]     │         │  НЕТ → Регистрация +        │
│  [Войти]                │         │        Подтверждение email   │
│                         │         │        + Captcha             │
│                         │         │                             │
│                         │         │  → Consent Screen            │
│                         │ ◄────── │  → redirect с code           │
│                         │         │                             │
│  Пользователь           │         └─────────────────────────────┘
│    авторизован           │
└─────────────────────────┘
```

### 1.2 Ключевые принципы

- **Регистрация с подтверждением** — пользователь обязательно подтверждает email 6-значным кодом
- **Consent Screen** — при первом входе пользователь явно разрешает доступ к данным
- **Полная безопасность** — CSRF (state), PKCE, httpOnly cookies, шифрование токенов
- **Вам не нужно** реализовывать регистрацию, подтверждение email, captcha — WaySenID делает всё сам

---

## 2. Кнопка «Войти через WaySenID»

### 2.1 Варианты

| Вариант | Фон | Текст | Рамка | Для чего |
|---------|-----|-------|-------|----------|
| **Primary** | `#0f172a` | `#fff` | нет | Основная кнопка на странице входа |
| **Outline** | `#fff` | `#0f172a` | `1.5px solid #e2e5e9` | Альтернативный вариант, светлый фон |
| **Minimal** | прозрачный | `#64748b` | нет | Компактная ссылка |

### 2.2 Размеры

| Размер | Высота | Паддинг | Шрифт | Радиус | Иконка |
|--------|--------|---------|-------|--------|--------|
| `lg` | 48px | 0 28px | 15px | 12px | 20px |
| `md` | 40px | 0 22px | 14px | 10px | 18px |
| `sm` | 34px | 0 16px | 13px | 8px | 16px |

### 2.3 HTML-разметка

```html
<!-- Primary, размер md -->
<button class="wsid-btn wsid-btn--primary wsid-btn--md" onclick="WaySenID.login()">
  <svg class="wsid-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10
             15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
  Войти через WaySenID
</button>
```

### 2.4 CSS

Полные стили — в файле [waysenid.css](./waysenid.css).

```css
/* ─── Base ─── */
.wsid-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

/* Primary */
.wsid-btn--primary { background: #0f172a; color: #fff; }
.wsid-btn--primary:hover { background: #1e293b; box-shadow: 0 4px 12px rgba(15,23,42,0.2); }

/* Outline */
.wsid-btn--outline { background: #fff; color: #0f172a; border: 1.5px solid #e2e5e9; }
.wsid-btn--outline:hover { border-color: #0f172a; }
```

---

## 3. Режимы авторизации

### 3.1 Popup (рекомендуемый)

Открывается отдельное окно, после авторизации оно закрывается и передаёт результат через `postMessage`.

```
Родительское окно                   Popup (auth.markbase.ru)
┌────────────────┐                 ┌───────────────────────┐
│  Ваш сайт      │ ── open ──►    │  Account Picker       │
│                │                 │  user@mail.ru    ✓    │
│  [Войти через  │                 │  other@mail.ru        │
│   WaySenID]    │                 │  + Другой аккаунт     │
│                │ ◄── postMsg ── │  (закрывается)        │
│  Авторизован   │                 └───────────────────────┘
└────────────────┘
```

**Параметры popup-окна:** 480×640px, по центру экрана.

**Проверка origin (обязательно!):**

```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://auth.markbase.ru') return;
  if (event.data.type === 'wsid:auth_success') {
    exchangeCodeForToken(event.data.code);
  }
});
```

### 3.2 Redirect (fallback)

```
https://auth.markbase.ru/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yoursite.com/callback&
  scope=openid+profile+email&
  state=RANDOM_STATE&
  code_challenge=...&
  code_challenge_method=S256
```

---

## 4. OAuth 2.0 Endpoints

| Endpoint | URL | Метод |
|----------|-----|-------|
| Authorization | `https://auth.markbase.ru/oauth/authorize` | GET |
| Token | `https://auth.markbase.ru/oauth/token` | POST |
| UserInfo | `https://auth.markbase.ru/oauth/userinfo` | GET |
| Revoke | `https://auth.markbase.ru/oauth/revoke` | POST |
| JWKS | `https://auth.markbase.ru/.well-known/jwks.json` | GET |
| OpenID Config | `https://auth.markbase.ru/.well-known/openid-configuration` | GET |

### 4.1 Параметры `/oauth/authorize`

| Параметр | Обязательный | Описание |
|----------|:---:|----------|
| `response_type` | Да | Всегда `code` |
| `client_id` | Да | ID приложения из Registry |
| `redirect_uri` | Да | URL возврата (должен совпадать с зарегистрированным) |
| `scope` | Да | Запрашиваемые разрешения (`openid profile email`) |
| `state` | Да | Случайная строка для CSRF-защиты |
| `code_challenge` | Рекомендуется | PKCE challenge (SHA-256) |
| `code_challenge_method` | Рекомендуется | `S256` |
| `prompt` | Нет | `login` / `consent` / `select_account` / `none` |
| `login_hint` | Нет | Email для предзаполнения формы входа |
| `display` | Нет | `popup` / `page` |

### 4.2 Обмен code на token

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET&
redirect_uri=https://yoursite.com/callback&
code_verifier=ORIGINAL_CODE_VERIFIER
```

**Ответ:**

```json
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBh...",
  "id_token": "eyJhbGci...",
  "scope": "openid profile email"
}
```

### 4.3 Получение данных пользователя

```http
GET /oauth/userinfo
Authorization: Bearer ACCESS_TOKEN
```

```json
{
  "sub": "user_abc123",
  "name": "Иван Петров",
  "email": "ivan@example.com",
  "email_verified": true,
  "picture": null,
  "updated_at": 1707480000
}
```

---

## 5. Scopes (разрешения)

| Scope | Описание | Данные |
|-------|----------|--------|
| `openid` | Идентификация (обязательный) | `sub` |
| `profile` | Имя, аватар | `name`, `picture`, `updated_at` |
| `email` | Email | `email`, `email_verified` |
| `phone` | Телефон | `phone_number`, `phone_number_verified` |
| `billing` | Биллинг | Тариф, подписки, лимиты |
| `wallet` | Кошелёк | Баланс, последние транзакции |
| `modules` | Модули | Список подключённых модулей |

---

## 6. Account Picker

Показывается когда у пользователя >1 аккаунт или при `prompt=select_account`.

```
┌──────────────────────────────────────┐
│         WaySenID                     │
│      Выберите аккаунт                │
│  для продолжения в «App Name»        │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ (ИП)  Иван Петров      ✓   │    │
│  │       iv***@mail.ru          │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ (МС)  Мария Сидорова        │    │
│  │       ma***@gmail.com        │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  +  Использовать другой      │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

**Дизайн:** карточка 440px, скругление 16px, тень `0 4px 24px rgba(0,0,0,0.08)`.

---

## 7. Consent Screen

Показывается при первом входе в новое приложение.

```
┌──────────────────────────────────────┐
│         WaySenID                     │
│                                      │
│  Приложение «App Name»              │
│  (app.example.com) запрашивает:      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Ваше имя и фото профиля    │    │
│  │  Ваш email адрес            │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Отклонить]  [Разрешить]            │
└──────────────────────────────────────┘
```

---

## 8. JS SDK

### 8.1 Подключение

**CDN:**
```html
<script src="https://auth.markbase.ru/sdk/waysenid.js"></script>
```

**npm:**
```bash
npm install @markbase/waysenid-sdk
```

### 8.2 Инициализация

```javascript
WaySenID.init({
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: 'https://yoursite.com/callback',
  scope: 'openid profile email',
  mode: 'popup',           // 'popup' | 'redirect'
  auto_select: true,       // auto-login если 1 аккаунт
  prompt: 'select_account'
});
```

### 8.3 Рендер кнопки

```javascript
WaySenID.renderButton('#wsid-button', {
  variant: 'primary',   // 'primary' | 'outline' | 'minimal'
  size: 'md',           // 'lg' | 'md' | 'sm'
  text: 'Войти через WaySenID',
  width: '100%',
});
```

### 8.4 Программный вызов

```javascript
// Popup-режим
const result = await WaySenID.login({
  mode: 'popup',
  prompt: 'select_account',
});

if (result.success) {
  await fetch('/api/auth/callback', {
    method: 'POST',
    body: JSON.stringify({ code: result.code })
  });
}
```

### 8.5 События

```javascript
WaySenID.on('login', (user) => console.log('Logged in:', user.email));
WaySenID.on('logout', () => console.log('Logged out'));
WaySenID.on('token_expired', () => WaySenID.refreshToken());
WaySenID.on('error', (err) => console.error(err.code, err.message));
```

### 8.6 Выход

```javascript
await WaySenID.logout();
await WaySenID.logout({ global: true }); // из всех приложений
```

---

## 9. Интеграция: пошагово

### 9.1 Регистрация приложения

1. Перейти в [Registry](https://registry.markbase.ru) → «Создать приложение»
2. Указать название, домен, redirect_uri, scopes
3. Получить `client_id` и `client_secret`

### 9.2 Минимальная интеграция (HTML)

```html
<div id="wsid-button"></div>
<script src="https://auth.markbase.ru/sdk/waysenid.js"></script>
<script>
  WaySenID.init({
    client_id: 'YOUR_CLIENT_ID',
    redirect_uri: window.location.origin + '/callback',
    scope: 'openid profile email'
  });
  WaySenID.renderButton('#wsid-button', { variant: 'primary', size: 'lg', width: '100%' });
</script>
```

### 9.3 React

```jsx
import { WaySenIDButton, WaySenIDProvider } from '@markbase/waysenid-sdk/react';

function App() {
  return (
    <WaySenIDProvider clientId="YOUR_CLIENT_ID" redirectUri="/callback" scope="openid profile email">
      <LoginPage />
    </WaySenIDProvider>
  );
}
```

### 9.4 Backend (Python/FastAPI)

```python
@app.get("/callback")
async def oauth_callback(code: str, state: str):
    # 1. Проверить state (CSRF)
    # 2. POST /oauth/token → получить access_token
    # 3. GET /oauth/userinfo → данные пользователя
    # 4. Создать сессию
```

> Полный backend-код — в [INTEGRATION.md](./INTEGRATION.md)

---

## 10. Регистрация нового пользователя

Когда пользователь нажимает «Войти через WaySenID» и у него **нет аккаунта**, WaySenID автоматически проводит его через регистрацию:

```
Email → Проверка → Пароль → Captcha → Согласия → Письмо → Код → Аккаунт
```

| Вам НЕ нужно | Вам НУЖНО |
|--------------|-----------|
| Реализовывать регистрацию | Обработать callback (code → token) |
| Подтверждать email | Создать пользователя в своей БД |
| Хранить пароли WaySenID | Проверить `email_verified: true` |
| Captcha | Показать onboarding новому пользователю |

---

## 11. Безопасность

| Механизм | Описание |
|----------|----------|
| **CSRF (state)** | Обязательный случайный `state` |
| **PKCE** | Рекомендуется для SPA. `code_challenge_method=S256` |
| **Token storage** | `access_token` — только в httpOnly cookie |
| **CORS** | Только зарегистрированные `redirect_uri` |
| **Token rotation** | `refresh_token` — одноразовый |
| **Origin check** | Обязательная проверка `event.origin` в popup-режиме |

> Полный чеклист безопасности — в [INTEGRATION.md](./INTEGRATION.md)

---

## 12. Дизайн-гайдлайны

- Кнопка ДОЛЖНА использовать стандартную иконку WaySenID (globe SVG)
- ЗАПРЕЩЕНО изменять текст, цвета или пропорции иконки
- Допустимые тексты: «Войти через WaySenID», «Продолжить с WaySenID», «WaySenID»
- Кнопка ДОЛЖНА быть не менее 34px высотой (размер `sm`)

**Цветовая палитра:**

```
Primary:         #0f172a
Text:            #1a1a2e
Secondary text:  #64748b
Border:          #e2e5e9
Background:      #f7f8fa
Card:            #ffffff
Success:         #16a34a
Danger:          #ef4444
```

---

## 13. Ошибки

| Код | Описание |
|-----|----------|
| `access_denied` | Пользователь отклонил запрос |
| `login_required` | Нет сессии (при `prompt=none`) |
| `invalid_client` | Неверный `client_id` |
| `invalid_redirect_uri` | URI не зарегистрирован |
| `registration_pending` | Email не подтверждён |
| `popup_closed` | Пользователь закрыл popup |
| `server_error` | Внутренняя ошибка |

---

## 14. Быстрый старт (5 минут)

```bash
npm install @markbase/waysenid-sdk
```

```javascript
WaySenID.init({
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: window.location.origin + '/auth/callback',
  scope: 'openid profile email',
});

WaySenID.renderButton('#login-btn', {
  variant: 'primary',
  size: 'lg',
  width: '100%',
});
```

> Реализовать callback на backend → см. [INTEGRATION.md](./INTEGRATION.md) §6

---

## Changelog

### 2026-02-09
- **v3.0.0** — One Tap auto sign-in, Developer Dashboard, FedCM API, webhooks
- **v2.0.0** — Полное руководство интеграции, пример WayGPT, чеклист безопасности
- **v1.0.0** — Начальная спецификация: кнопка, OAuth flow, SDK
