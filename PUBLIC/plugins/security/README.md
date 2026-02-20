# Plugin: Security — Безопасность

> **Версия:** 1.1.0
> **Slug:** `security`
> **Endpoint:** `https://security.markbase.ru`
> **Порт:** 8061

---

## Обзор

Security — модуль безопасности платформы MarkBase. Обеспечивает централизованную защиту всех сервисов: rate limiting, фильтрация IP-адресов и ведение аудит-логов.

**Возможности:**
- **Rate Limiting** — ограничение частоты запросов по ключу (IP, user_id, API-ключ)
- **IP Allowlist/Denylist** — белые и чёрные списки IP-адресов
- **Audit Log** — централизованный журнал действий всех модулей
- **WAF-подобная защита** — блокировка подозрительных запросов

---

## Интеграция с UAM v1.3.0

> С версии UAM 1.3.0 модуль аутентификации включает **встроенную многоуровневую защиту**.
> Security API дополняет эту защиту для **остальных модулей** платформы.

### Встроенная защита UAM (автоматически)

| Модуль | Описание | Конфигурация |
|--------|----------|-------------|
| **Brute-Force Protection** | Ограничение попыток входа | 10 попыток / 30 мин |
| **Progressive Lockout** | Нарастающая блокировка IP | 60 → 120 → 240 мин |
| **IP Auto-Block** | Автоблокировка при нарушениях | В таблицу `blocked_ips` |
| **Global Rate Limiter** | Ограничение всех API UAM | 120 req/min |
| **Auth Rate Limiter** | Ограничение `/login`, `/register` | 20 req/min |
| **IP Allowlist** | Пользовательская фильтрация IP | Настраивается пользователем |
| **Password Policy** | Требования к паролю | 8+ символов, A-z, 0-9 |
| **Security Headers** | HSTS, X-Frame, X-XSS | Автоматически |
| **Audit Logging** | Логирование событий безопасности | В таблицу `audit_log` |
| **Session Security** | HTTP-only cookies, TTL | 72 часа |

> Все эти модули работают **автоматически** при использовании UAM. Вам не нужно дополнительно настраивать Security API для защиты входа.

### Security API для остальных модулей

Security API используется для защиты **ваших собственных эндпоинтов** и логирования действий:

```
┌───────────────┐                    ┌──────────────────┐
│  Ваш модуль   │ ───── Rate ────> │  Security API    │
│  /api/orders  │      Limit       │  /ratelimit/check │
│               │ ───── Audit ──> │  /audit           │
│               │      Log         │                    │
└───────────────┘                    └──────────────────┘
        │
        │ ───── Login ────>  ┌──────────────────┐
        │                     │  UAM (WaySenID)  │
        │ <── Session ──────  │  Встроенная       │
        │                     │  защита v1.3.0   │
                              └──────────────────┘
```

---

## Быстрый старт

### 1. Проверка rate limit

```bash
curl -X POST https://security.markbase.ru/api/security/v1/ratelimit/check \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"key": "ip:192.168.1.1", "limit": 100, "window_seconds": 60}'
```

Ответ:
```json
{
  "allowed": true,
  "remaining": 95,
  "reset_at": "2026-02-08T12:01:00Z"
}
```

### 2. Запись в аудит-лог

```bash
curl -X POST https://security.markbase.ru/api/security/v1/audit \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action": "user.login", "actor": "user_123", "target": "session_456", "meta": {"ip": "1.2.3.4"}}'
```

### 3. Проверить статус встроенной защиты UAM

```bash
# Публичный эндпоинт — информация о модулях защиты
curl -s https://auth.markbase.ru/api/uam/v1/security/protection-info | jq .
```

Ответ:
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

## 1. Интеграция: JavaScript / Express

### Middleware для rate limiting

```javascript
const axios = require('axios');

const SECURITY_URL = process.env.SECURITY_URL || 'https://security.markbase.ru';
const SECURITY_API_KEY = process.env.SECURITY_API_KEY;

// Express middleware: rate limiting через Security API
function rateLimitMiddleware(options = {}) {
  const { limit = 100, windowSeconds = 60, keyFn } = options;

  return async (req, res, next) => {
    const key = keyFn ? keyFn(req) : `ip:${req.ip}`;

    try {
      const { data } = await axios.post(
        `${SECURITY_URL}/api/security/v1/ratelimit/check`,
        { key, limit, window_seconds: windowSeconds },
        { headers: { 'X-API-Key': SECURITY_API_KEY } }
      );

      res.set('X-RateLimit-Remaining', data.remaining);
      res.set('X-RateLimit-Reset', data.reset_at);

      if (!data.allowed) {
        return res.status(429).json({ error: 'Too Many Requests', retry_after: data.reset_at });
      }

      next();
    } catch (err) {
      // При ошибке Security — пропускаем (fail open)
      console.error('Security rate limit check failed:', err.message);
      next();
    }
  };
}

// Middleware: запись в аудит-лог
function auditLog(action, getDetails) {
  return async (req, res, next) => {
    res.on('finish', async () => {
      try {
        const details = getDetails ? getDetails(req, res) : {};
        await axios.post(
          `${SECURITY_URL}/api/security/v1/audit`,
          {
            action,
            actor: req.user?.user_id || 'anonymous',
            target: req.originalUrl,
            meta: { ip: req.ip, status: res.statusCode, ...details }
          },
          { headers: { 'X-API-Key': SECURITY_API_KEY } }
        );
      } catch (err) {
        console.error('Audit log failed:', err.message);
      }
    });
    next();
  };
}

// Использование
const express = require('express');
const app = express();

// Rate limit: 100 запросов в минуту по IP
app.use('/api/', rateLimitMiddleware({ limit: 100, windowSeconds: 60 }));

// Аудит-лог на критичные эндпоинты
app.post('/api/orders', auditLog('order.create'), (req, res) => {
  // ... создание заказа
});
```

---

## 2. Интеграция: Python / FastAPI

```python
import httpx
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

SECURITY_URL = "https://security.markbase.ru"
SECURITY_API_KEY = "mk_sec_abc123..."

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        key = f"ip:{request.client.host}"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{SECURITY_URL}/api/security/v1/ratelimit/check",
                    json={"key": key, "limit": self.limit, "window_seconds": self.window_seconds},
                    headers={"X-API-Key": SECURITY_API_KEY},
                    timeout=5
                )
                result = resp.json()

                if not result.get("allowed"):
                    raise HTTPException(
                        status_code=429,
                        detail={"error": "Too Many Requests", "reset_at": result["reset_at"]}
                    )
        except httpx.HTTPError:
            pass  # fail open

        response = await call_next(request)
        return response


# Запись в аудит-лог
async def write_audit(action: str, actor: str, target: str, meta: dict = None):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{SECURITY_URL}/api/security/v1/audit",
            json={"action": action, "actor": actor, "target": target, "meta": meta or {}},
            headers={"X-API-Key": SECURITY_API_KEY},
            timeout=5
        )


# Проверка IP в списке
async def check_ip(ip: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SECURITY_URL}/api/security/v1/iplist/check",
            params={"ip": ip},
            headers={"X-API-Key": SECURITY_API_KEY},
            timeout=5
        )
        return resp.json()  # { "status": "allowed" | "denied", "list": "allowlist" | "denylist" }


# Использование
from fastapi import FastAPI

app = FastAPI()
app.add_middleware(RateLimitMiddleware, limit=100, window_seconds=60)

@app.post("/api/orders")
async def create_order(request: Request):
    await write_audit("order.create", request.state.user_id, "/api/orders")
    return {"status": "ok"}
```

---

## 3. Интеграция: PHP

```php
<?php
define('SECURITY_URL', 'https://security.markbase.ru');
define('SECURITY_API_KEY', 'mk_sec_abc123...');

// Проверка rate limit
function security_check_ratelimit(string $key, int $limit = 100, int $window = 60): array {
    $ch = curl_init(SECURITY_URL . '/api/security/v1/ratelimit/check');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'key' => $key, 'limit' => $limit, 'window_seconds' => $window
        ]),
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . SECURITY_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true) ?? ['allowed' => true];
}

// Запись аудит-лога
function security_audit(string $action, string $actor, string $target, array $meta = []): void {
    $ch = curl_init(SECURITY_URL . '/api/security/v1/audit');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'action' => $action, 'actor' => $actor,
            'target' => $target, 'meta' => $meta
        ]),
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . SECURITY_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 5
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// Проверка IP
function security_check_ip(string $ip): ?array {
    $ch = curl_init(SECURITY_URL . '/api/security/v1/iplist/check?ip=' . urlencode($ip));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-API-Key: ' . SECURITY_API_KEY],
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// Использование
$result = security_check_ratelimit('ip:' . $_SERVER['REMOTE_ADDR']);
if (!$result['allowed']) {
    http_response_code(429);
    echo json_encode(['error' => 'Too Many Requests']);
    exit;
}
```

---

## 4. Интеграция: WordPress

### Плагин: `markbase-security.php`

```php
<?php
/**
 * Plugin Name: MarkBase Security
 * Description: Rate limiting и аудит-лог для WordPress через MarkBase Security
 * Version: 1.1.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_SECURITY_URL', 'https://security.markbase.ru');
define('MB_SECURITY_API_KEY', get_option('mb_security_api_key', ''));

// === Rate limit перед отправкой форм ===
add_action('init', function() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;

    $key = 'ip:' . $_SERVER['REMOTE_ADDR'];
    $response = wp_remote_post(MB_SECURITY_URL . '/api/security/v1/ratelimit/check', [
        'headers' => [
            'X-API-Key' => MB_SECURITY_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'key' => $key,
            'limit' => 20,
            'window_seconds' => 60
        ]),
        'timeout' => 5
    ]);

    if (!is_wp_error($response)) {
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (isset($data['allowed']) && !$data['allowed']) {
            wp_die(
                'Слишком много запросов. Попробуйте позже.',
                'Rate Limited',
                ['response' => 429, 'back_link' => true]
            );
        }
    }
});

// === Аудит-лог: логин пользователя ===
add_action('wp_login', function($user_login, $user) {
    $body = json_encode([
        'action' => 'wp.user.login',
        'actor' => (string) $user->ID,
        'target' => 'wordpress',
        'meta' => [
            'username' => $user_login,
            'ip' => $_SERVER['REMOTE_ADDR'],
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]
    ]);

    wp_remote_post(MB_SECURITY_URL . '/api/security/v1/audit', [
        'headers' => [
            'X-API-Key' => MB_SECURITY_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'body' => $body,
        'timeout' => 5,
        'blocking' => false // Неблокирующий запрос
    ]);
}, 10, 2);

// === Аудит-лог: неудачный логин ===
add_action('wp_login_failed', function($username) {
    wp_remote_post(MB_SECURITY_URL . '/api/security/v1/audit', [
        'headers' => [
            'X-API-Key' => MB_SECURITY_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'action' => 'wp.user.login_failed',
            'actor' => 'anonymous',
            'target' => 'wordpress',
            'meta' => ['username' => $username, 'ip' => $_SERVER['REMOTE_ADDR']]
        ]),
        'timeout' => 5,
        'blocking' => false
    ]);
});

// === Страница настроек ===
add_action('admin_menu', function() {
    add_options_page('MarkBase Security', 'MarkBase Security', 'manage_options', 'markbase-security', function() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('mb_security_save')) {
            update_option('mb_security_api_key', sanitize_text_field($_POST['api_key']));
            echo '<div class="updated"><p>Сохранено.</p></div>';
        }
        $key = get_option('mb_security_api_key', '');
        echo '<div class="wrap"><h1>MarkBase Security</h1>';
        echo '<form method="post">';
        wp_nonce_field('mb_security_save');
        echo '<table class="form-table">';
        echo '<tr><th>API Key</th><td><input type="text" name="api_key" value="' . esc_attr($key) . '" class="regular-text" /></td></tr>';
        echo '<tr><th>Security URL</th><td>' . MB_SECURITY_URL . '</td></tr>';
        echo '<tr><th>UAM Protection</th><td>UAM v1.3.0 включает встроенную защиту (brute-force, DDoS, IP-блокировка)</td></tr>';
        echo '</table>';
        submit_button('Сохранить');
        echo '</form></div>';
    });
});
```

### Установка

1. Скопируйте `markbase-security.php` в `/wp-content/plugins/markbase-security/`
2. Активируйте в **Плагины → MarkBase Security**
3. Укажите API-ключ в **Настройки → MarkBase Security**

---

## API Reference

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/security/v1/ratelimit/check` | Проверка rate limit: `{key, limit, window_seconds}` |
| GET | `/api/security/v1/iplist` | Получить IP-списки (allowlist/denylist) |
| GET | `/api/security/v1/iplist/check` | Проверить IP: `?ip=...` → `{status, list}` |
| GET | `/api/security/v1/audit` | Получить аудит-лог: `?actor=...&action=...&from=...&to=...` |
| POST | `/api/security/v1/audit` | Записать событие: `{action, actor, target, meta}` |
| GET | `/api/security/v1/health` | Health check |

### UAM Security API (встроенные эндпоинты v1.3.0)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/uam/v1/security/status` | Статус безопасности аккаунта |
| GET | `/api/uam/v1/security/settings` | Настройки безопасности |
| POST | `/api/uam/v1/security/settings` | Обновить настройки |
| GET | `/api/uam/v1/security/login-history` | История входов |
| GET | `/api/uam/v1/security/protection-info` | Информация о защите (публичный) |

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `SECURITY_URL` | `https://security.markbase.ru` | Публичный URL сервиса |
| `SECURITY_PORT` | `8061` | Порт сервиса |
| `SECURITY_API_KEY` | — | API-ключ для доступа |
| `RATE_LIMIT_DEFAULT` | `100` | Лимит запросов по умолчанию |
| `RATE_LIMIT_WINDOW` | `60` | Окно в секундах |

---

## Отказоустойчивость (UAM Graceful Degradation)

Модуль Security использует **кэш сессий UAM** для обеспечения бесперебойной работы:

- При каждой успешной валидации сессии через UAM — результат кэшируется **на 15 минут**
- Если UAM временно недоступен — используется закэшированный результат
- Если UAM явно вернул 401 — сессия немедленно удаляется из кэша
- Фоновое обновление кэша происходит каждые **60 секунд** при доступном UAM

> Залогиненные пользователи **не вылетят** из Security при кратковременных проблемах auth.markbase.ru.

Подробнее: см. [UAM Plugin → Отказоустойчивость](../uam/README.md#отказоустойчивость-graceful-degradation)

---

## Changelog

### 1.1.0 (2026-02-08)
- Интеграция с встроенной защитой UAM v1.3.0
- Документация обновлена: описание встроенных модулей безопасности UAM
- Добавлена ссылка на UAM Security API эндпоинты
- WordPress-плагин обновлён с информацией о UAM Protection
- Архитектурная диаграмма: UAM vs Security API

### 1.0.0 (2026-02-07)
- Первый релиз
- Rate limiting с гибкими ключами (IP, user_id, API-key)
- IP allowlist/denylist с проверкой через API
- Централизованный аудит-лог для всех модулей
- Middleware примеры: Express, FastAPI
- WordPress-плагин: rate limit форм, аудит логинов
- Session cache: graceful degradation при недоступности UAM
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

