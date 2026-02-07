# Plugin: UAM (WaySenID) — Единая аутентификация

> **Версия:** 1.2.0  
> **Slug:** `uam`  
> **Endpoint:** `https://auth.markbase.ru`  
> **Cookie:** `uam_session` на `.markbase.ru`

---

## Обзор

UAM (WaySenID) — централизованный сервис аутентификации платформы MarkBase. Все модули и сторонние проекты используют единый вход через UAM.

**Принцип:** пользователь регистрируется и входит **один раз** через auth.markbase.ru. Cookie `uam_session` действует на всех поддоменах `.markbase.ru`. Сторонние проекты валидируют сессию через API.

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

### Вход (Login)

```
Пользователь → Ваш проект (/dashboard)
   │
   ├── Cookie uam_session есть?
   │     ├── Да → валидация (см. кэш) → показать dashboard
   │     └── Нет → redirect на auth.markbase.ru/login?return_url=...
   │
auth.markbase.ru/login
   │
   ├── Есть запомненный аккаунт? → показываем подсказку (email, имя)
   ├── Пользователь вводит email + пароль
   ├── POST /api/uam/v1/login → Set-Cookie: uam_session (Domain: .markbase.ru)
   ├── Аккаунт запоминается в localStorage браузера
   └── Redirect обратно на return_url → ваш /dashboard
```

### Регистрация (Register)

```
Пользователь → Ваш проект (/register или кнопка "Зарегистрироваться")
   │
   └── Redirect на auth.markbase.ru/register?return_url=...

auth.markbase.ru/register
   │
   ├── Поля: Email, Пароль (мин. 8 символов), Имя, Компания
   ├── POST /api/uam/v1/register
   │     → Создаёт пользователя
   │     → Автоматически подписывает обязательные согласия
   │     → Создаёт сессию + Set-Cookie
   │     → Аккаунт запоминается в localStorage
   └── Redirect обратно на return_url → ваш /dashboard
```

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
| 409 | Пользователь уже существует | Email уже занят |

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
  { "email": "user@example.com", "display_name": "Иван Петров", "last_login": "2026-02-07T12:00:00Z" },
  { "email": "admin@company.ru", "display_name": "Администратор", "last_login": "2026-02-06T10:00:00Z" }
]
```

**Поведение на странице входа:**
- 1 запомненный аккаунт → карточка с именем и замаскированным email, кнопка "Другой аккаунт"
- Несколько аккаунтов → список для выбора, кнопка удаления для каждого
- Нет аккаунтов → обычная форма email + пароль

**Если ваш проект на другом домене** (не `*.markbase.ru`):
- Cookie `uam_session` не будет доступна автоматически
- Используйте API `POST /api/uam/v1/login` напрямую
- Сохраняйте токен из ответа в своей системе
- Или используйте redirect-flow через `return_url`

### API: Полный справочник

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/uam/v1/register` | Регистрация: `{email, password, display_name, company_name}` |
| POST | `/api/uam/v1/login` | Вход: `{email, password}` → Set-Cookie |
| POST | `/api/uam/v1/logout` | Выход: удаление cookie |
| POST | `/api/uam/v1/logout-all` | Выход из всех устройств: `{keep_current?: bool}` |
| GET | `/api/uam/v1/me` | Текущий пользователь (требует cookie) |
| GET | `/api/uam/v1/session/validate` | Валидация сессии (для backend-модулей) |
| PATCH | `/api/uam/v1/profile` | Обновление профиля: `{display_name}` |
| POST | `/api/uam/v1/change-password` | Смена пароля: `{current_password, new_password, logout_all?}` |
| GET | `/api/uam/v1/sessions` | Список активных сессий |
| DELETE | `/api/uam/v1/sessions/:id` | Отзыв конкретной сессии |
| POST | `/api/uam/v1/verify-email` | Подтверждение email: `{token}` |
| GET | `/api/uam/v1/ip-allowlist` | Список разрешённых IP |
| POST | `/api/uam/v1/ip-allowlist` | Добавить IP: `{ip_address, label}` |
| DELETE | `/api/uam/v1/ip-allowlist/:id` | Удалить IP из списка |
| POST | `/api/uam/v1/ip-allowlist/add-current` | Добавить текущий IP клиента |

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

| Переменная | Значение для Docker-сети | Значение для внешних |
|-----------|--------------------------|---------------------|
| `UAM_INTERNAL` | `http://uam:8060` | `https://auth.markbase.ru` |
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

### Шаг 4. Проверьте интеграцию

```bash
# 1. Проверить что UAM доступен
curl -s https://auth.markbase.ru/health | jq .

# 2. Зарегистрировать тестового пользователя
curl -s -X POST https://auth.markbase.ru/api/uam/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yoursite.com","password":"TestPass123","display_name":"Тест"}' | jq .

# 3. Войти и получить cookie
curl -s -X POST https://auth.markbase.ru/api/uam/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yoursite.com","password":"TestPass123"}' \
  -c cookies.txt | jq .

# 4. Проверить сессию
curl -s https://auth.markbase.ru/api/uam/v1/me -b cookies.txt | jq .

# 5. Валидация сессии (как это делает ваш backend)
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

const UAM_INTERNAL = 'http://uam:8060'; // Docker-сеть
// или 'https://auth.markbase.ru' для внешних проектов

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

UAM_INTERNAL = "http://uam:8060"  # Docker
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
 * Version: 1.1.0
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
| `UAM_INTERNAL` | `http://uam:8060` | Внутренний URL (Docker-сеть) |
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

---

## Changelog

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
