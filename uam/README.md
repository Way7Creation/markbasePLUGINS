# Plugin: UAM (WaySenID) — Единая аутентификация

> **Версия:** 1.0.0  
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

## 1. Интеграция: JavaScript / React

### Кнопка входа

```javascript
// Redirect на UAM login с return_url
const UAM_URL = 'https://auth.markbase.ru';
const RETURN_URL = encodeURIComponent(window.location.origin + '/dashboard');

function LoginButton() {
  return (
    <a href={`${UAM_URL}/login?return_url=${RETURN_URL}`}>
      Войти через MarkBase
    </a>
  );
}
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

### Валидация на Backend (Node.js)

```javascript
const axios = require('axios');

const UAM_INTERNAL = 'http://uam:8060'; // Docker-сеть
// или 'https://auth.markbase.ru' для внешних проектов

async function validateSession(req) {
  const cookie = req.cookies?.uam_session;
  if (!cookie) return null;

  try {
    const { data } = await axios.get(
      `${UAM_INTERNAL}/api/uam/v1/session/validate`,
      { headers: { Cookie: `uam_session=${cookie}` } }
    );
    return data; // { user_id, email, display_name, role, consents_accepted }
  } catch {
    return null;
  }
}

// Express middleware
function requireAuth(req, res, next) {
  validateSession(req).then(user => {
    if (!user) return res.redirect('https://auth.markbase.ru/login?return_url=' + req.originalUrl);
    req.user = user;
    next();
  });
}
```

---

## 2. Интеграция: Python / FastAPI

```python
import httpx
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse

UAM_INTERNAL = "http://uam:8060"  # Docker
UAM_PUBLIC = "https://auth.markbase.ru"
COOKIE = "uam_session"

def validate_session(request: Request):
    cookie = request.cookies.get(COOKIE)
    if not cookie:
        return None
    try:
        resp = httpx.get(
            f"{UAM_INTERNAL}/api/uam/v1/session/validate",
            cookies={COOKIE: cookie}, timeout=5
        )
        return resp.json() if resp.status_code == 200 else None
    except:
        return None

def require_auth(request: Request, return_url: str):
    user = validate_session(request)
    if not user:
        raise HTTPException(302, headers={
            "Location": f"{UAM_PUBLIC}/login?return_url={return_url}"
        })
    return user
```

---

## 3. Интеграция: PHP

```php
<?php
define('UAM_URL', 'https://auth.markbase.ru');
define('UAM_COOKIE', 'uam_session');

function uam_validate_session(): ?array {
    $cookie = $_COOKIE[UAM_COOKIE] ?? null;
    if (!$cookie) return null;

    $ch = curl_init(UAM_URL . '/api/uam/v1/session/validate');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Cookie: " . UAM_COOKIE . "=" . $cookie],
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200) {
        return json_decode($response, true);
    }
    return null;
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

function uam_logout_url(string $return_url): string {
    return UAM_URL . '/api/uam/v1/logout?return_url=' . urlencode($return_url);
}
```

---

## 4. Интеграция: WordPress

### Файл плагина: `markbase-auth.php`

```php
<?php
/**
 * Plugin Name: MarkBase Auth (WaySenID)
 * Description: Единая аутентификация через MarkBase UAM
 * Version: 1.0.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_UAM_URL', 'https://auth.markbase.ru');
define('MB_UAM_COOKIE', 'uam_session');

// === Валидация сессии UAM ===
function mb_auth_validate_session() {
    $cookie = $_COOKIE[MB_UAM_COOKIE] ?? null;
    if (!$cookie) return null;

    $response = wp_remote_get(MB_UAM_URL . '/api/uam/v1/session/validate', [
        'cookies' => [new WP_Http_Cookie([
            'name' => MB_UAM_COOKIE,
            'value' => $cookie
        ])],
        'timeout' => 5
    ]);

    if (is_wp_error($response)) return null;
    if (wp_remote_retrieve_response_code($response) !== 200) return null;

    return json_decode(wp_remote_retrieve_body($response), true);
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

// === Маппинг ролей UAM → WordPress ===
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

// === Кнопка входа (шорткод) ===
add_shortcode('markbase_login', function($atts) {
    $atts = shortcode_atts(['text' => 'Войти через MarkBase'], $atts);
    $return_url = urlencode(home_url($_SERVER['REQUEST_URI']));
    return '<a href="' . MB_UAM_URL . '/login?return_url=' . $return_url
         . '" class="markbase-login-btn">' . esc_html($atts['text']) . '</a>';
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
        echo '<tr><th>Session</th><td>' . ($user ? 'Active (' . $user['email'] . ')' : 'Not connected') . '</td></tr>';
        echo '</table></div>';
    });
});
```

### Установка WordPress-плагина

1. Скопируйте `markbase-auth.php` в `/wp-content/plugins/markbase-auth/`
2. Активируйте в **Плагины → MarkBase Auth**
3. Используйте шорткод `[markbase_login]` для кнопки входа

---

## API Reference

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/uam/v1/login` | Вход: `{email, password}` → Set-Cookie |
| POST | `/api/uam/v1/register` | Регистрация: `{email, password, display_name}` |
| POST | `/api/uam/v1/logout` | Выход: удаление cookie |
| GET | `/api/uam/v1/me` | Текущий пользователь (требует cookie) |
| GET | `/api/uam/v1/session/validate` | Валидация сессии (для backend) |
| PATCH | `/api/uam/v1/profile` | Обновление профиля |
| POST | `/api/uam/v1/change-password` | Смена пароля |
| GET | `/api/uam/v1/sessions` | Список активных сессий |

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `UAM_URL` | `https://auth.markbase.ru` | Публичный URL |
| `UAM_SESSION_COOKIE` | `uam_session` | Имя cookie |
| `UAM_COOKIE_DOMAIN` | `.markbase.ru` | Домен cookie |
| `UAM_SESSION_TTL_HOURS` | `72` | Время жизни сессии |

---

## Changelog

### 1.0.0 (2026-02-07)
- Первый релиз
- Session-based аутентификация (bcrypt + HTTP-only cookie)
- SSO через cookie на `.markbase.ru`
- SSO cookie на домене `.markbase.ru` (все поддомены)
- CORS для `*.markbase.ru`
- Brute-force protection (10 попыток / 30 мин)
- Интеграция: JS, Python, PHP, WordPress
