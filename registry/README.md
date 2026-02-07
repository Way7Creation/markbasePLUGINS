# Plugin: Registry — Реестр модулей

> **Версия:** 1.0.0  
> **Slug:** `registry`  
> **Endpoint:** `https://registry.markbase.ru`  
> **Порт:** 8065

---

## Обзор

Registry — централизованный каталог всех модулей платформы MarkBase. Управляет API-ключами, HMAC-секретами для подписи запросов и маршрутизацией доменов.

**Возможности:**
- Каталог всех зарегистрированных модулей и их статусов
- Выдача и управление API-ключами для межмодульного взаимодействия
- HMAC-секреты для подписи запросов между сервисами
- Маршрутизация доменов — определение модуля по URL

---

## Быстрый старт

### 1. Получите API-ключ

```bash
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Cookie: uam_session=<YOUR_SESSION>" \
  -H "Content-Type: application/json" \
  -d '{"module_slug": "my-app", "name": "My Application"}'
```

Ответ:
```json
{
  "api_key": "mk_reg_abc123...",
  "hmac_secret": "hmac_sec_xyz789...",
  "module_id": "mod_001"
}
```

### 2. Список модулей

```bash
curl https://registry.markbase.ru/api/registry/v1/modules \
  -H "X-API-Key: mk_reg_abc123..."
```

---

## 1. Интеграция: JavaScript / Node.js

### Подключение к Registry

```javascript
const axios = require('axios');
const crypto = require('crypto');

const REGISTRY_URL = 'https://registry.markbase.ru';
const API_KEY = process.env.REGISTRY_API_KEY;
const HMAC_SECRET = process.env.REGISTRY_HMAC_SECRET;

// Получить список всех модулей
async function listModules() {
  const { data } = await axios.get(`${REGISTRY_URL}/api/registry/v1/modules`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return data; // [{ slug, name, version, status, endpoints }, ...]
}

// Подключить свой модуль
async function connectModule(slug, name) {
  const { data } = await axios.post(
    `${REGISTRY_URL}/api/registry/v1/connect`,
    { module_slug: slug, name },
    { headers: { 'X-API-Key': API_KEY } }
  );
  return data; // { api_key, hmac_secret, module_id }
}

// Определить модуль по домену
async function resolveDomain(domain) {
  const { data } = await axios.get(
    `${REGISTRY_URL}/api/registry/v1/resolve`,
    { params: { domain }, headers: { 'X-API-Key': API_KEY } }
  );
  return data; // { module_slug, api_base, port }
}
```

---

## 2. Интеграция: Python

```python
import httpx
import hmac
import hashlib
import time

REGISTRY_URL = "https://registry.markbase.ru"
API_KEY = "mk_reg_abc123..."
HMAC_SECRET = "hmac_sec_xyz789..."

headers = {"X-API-Key": API_KEY}

# Список модулей
def list_modules():
    resp = httpx.get(f"{REGISTRY_URL}/api/registry/v1/modules", headers=headers)
    return resp.json()

# Подключить модуль
def connect_module(slug: str, name: str):
    resp = httpx.post(
        f"{REGISTRY_URL}/api/registry/v1/connect",
        json={"module_slug": slug, "name": name},
        headers=headers
    )
    return resp.json()  # { api_key, hmac_secret, module_id }

# Список подключений
def list_connections():
    resp = httpx.get(f"{REGISTRY_URL}/api/registry/v1/connections", headers=headers)
    return resp.json()

# Резолв домена
def resolve_domain(domain: str):
    resp = httpx.get(
        f"{REGISTRY_URL}/api/registry/v1/resolve",
        params={"domain": domain}, headers=headers
    )
    return resp.json()
```

---

## 3. Интеграция: PHP

```php
<?php
define('REGISTRY_URL', 'https://registry.markbase.ru');
define('REGISTRY_API_KEY', 'mk_reg_abc123...');
define('REGISTRY_HMAC_SECRET', 'hmac_sec_xyz789...');

function registry_request(string $method, string $path, ?array $body = null): ?array {
    $ch = curl_init(REGISTRY_URL . $path);
    $headers = [
        'X-API-Key: ' . REGISTRY_API_KEY,
        'Content-Type: application/json'
    ];

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 10
    ]);

    if ($method === 'POST' && $body) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ($code >= 200 && $code < 300) ? json_decode($response, true) : null;
}

// Список модулей
function registry_list_modules(): ?array {
    return registry_request('GET', '/api/registry/v1/modules');
}

// Подключить модуль
function registry_connect(string $slug, string $name): ?array {
    return registry_request('POST', '/api/registry/v1/connect', [
        'module_slug' => $slug,
        'name' => $name
    ]);
}

// Резолв домена
function registry_resolve(string $domain): ?array {
    return registry_request('GET', '/api/registry/v1/resolve?domain=' . urlencode($domain));
}
```

---

## 4. Интеграция: WordPress

### Плагин: `markbase-registry.php`

```php
<?php
/**
 * Plugin Name: MarkBase Registry
 * Description: Показывает подключённые модули MarkBase через шорткод
 * Version: 1.0.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_REGISTRY_URL', 'https://registry.markbase.ru');
define('MB_REGISTRY_API_KEY', get_option('mb_registry_api_key', ''));

// === Шорткод: список подключённых модулей ===
add_shortcode('markbase_modules', function($atts) {
    $atts = shortcode_atts(['show' => 'all'], $atts);

    $response = wp_remote_get(MB_REGISTRY_URL . '/api/registry/v1/modules', [
        'headers' => ['X-API-Key' => MB_REGISTRY_API_KEY],
        'timeout' => 10
    ]);

    if (is_wp_error($response)) {
        return '<p>Не удалось загрузить модули.</p>';
    }

    $modules = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($modules)) {
        return '<p>Модули не найдены.</p>';
    }

    $html = '<div class="markbase-modules">';
    $html .= '<table class="wp-list-table widefat striped">';
    $html .= '<thead><tr><th>Модуль</th><th>Версия</th><th>Статус</th><th>URL</th></tr></thead>';
    $html .= '<tbody>';

    foreach ($modules as $mod) {
        $status = ($mod['status'] === 'active')
            ? '<span style="color:green">●</span> Active'
            : '<span style="color:red">●</span> Inactive';

        $html .= '<tr>';
        $html .= '<td><strong>' . esc_html($mod['name']) . '</strong></td>';
        $html .= '<td>' . esc_html($mod['version']) . '</td>';
        $html .= '<td>' . $status . '</td>';
        $html .= '<td><a href="' . esc_url($mod['homepage']) . '">' . esc_html($mod['homepage']) . '</a></td>';
        $html .= '</tr>';
    }

    $html .= '</tbody></table></div>';
    return $html;
});

// === Страница настроек ===
add_action('admin_menu', function() {
    add_options_page('MarkBase Registry', 'MarkBase Registry', 'manage_options', 'markbase-registry', function() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('mb_registry_save')) {
            update_option('mb_registry_api_key', sanitize_text_field($_POST['api_key']));
            echo '<div class="updated"><p>Сохранено.</p></div>';
        }
        $key = get_option('mb_registry_api_key', '');
        echo '<div class="wrap"><h1>MarkBase Registry</h1>';
        echo '<form method="post">';
        wp_nonce_field('mb_registry_save');
        echo '<table class="form-table">';
        echo '<tr><th>API Key</th><td><input type="text" name="api_key" value="' . esc_attr($key) . '" class="regular-text" /></td></tr>';
        echo '</table>';
        submit_button('Сохранить');
        echo '</form></div>';
    });
});
```

### Использование

1. Скопируйте `markbase-registry.php` в `/wp-content/plugins/markbase-registry/`
2. Активируйте в **Плагины → MarkBase Registry**
3. Укажите API-ключ в **Настройки → MarkBase Registry**
4. Используйте шорткод `[markbase_modules]` для отображения списка модулей

---

## HMAC-подпись запросов

Для межсервисного взаимодействия запросы подписываются с помощью HMAC-SHA256.

### Формат сообщения

```
{METHOD}\n{PATH}\n{TIMESTAMP}\n{BODY_SHA256}
```

- **METHOD** — HTTP-метод (`GET`, `POST`, ...)
- **PATH** — путь запроса (`/api/registry/v1/modules`)
- **TIMESTAMP** — Unix timestamp в секундах
- **BODY_SHA256** — SHA256-хеш тела запроса (пустая строка → SHA256 от `""`)

### Пример: Node.js

```javascript
const crypto = require('crypto');

function signRequest(method, path, body, hmacSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = crypto.createHash('sha256')
    .update(body || '')
    .digest('hex');

  const message = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = crypto.createHmac('sha256', hmacSecret)
    .update(message)
    .digest('hex');

  return { signature, timestamp };
}

// Использование
const { signature, timestamp } = signRequest(
  'GET', '/api/registry/v1/modules', '', HMAC_SECRET
);

const headers = {
  'X-API-Key': API_KEY,
  'X-Signature': signature,
  'X-Timestamp': timestamp
};
```

### Пример: Python

```python
import hmac
import hashlib
import time

def sign_request(method: str, path: str, body: str, hmac_secret: str):
    timestamp = str(int(time.time()))
    body_hash = hashlib.sha256((body or "").encode()).hexdigest()
    message = f"{method}\n{path}\n{timestamp}\n{body_hash}"
    signature = hmac.new(
        hmac_secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return {"X-Signature": signature, "X-Timestamp": timestamp}
```

---

## API Reference

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/registry/v1/modules` | Список всех зарегистрированных модулей |
| POST | `/api/registry/v1/connect` | Подключить модуль: `{module_slug, name}` → `{api_key, hmac_secret}` |
| GET | `/api/registry/v1/connections` | Список подключений текущего пользователя |
| GET | `/api/registry/v1/resolve` | Определить модуль по домену: `?domain=...` |
| GET | `/api/registry/v1/health` | Health check |

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `REGISTRY_URL` | `https://registry.markbase.ru` | Публичный URL сервиса |
| `REGISTRY_PORT` | `8065` | Порт сервиса |
| `REGISTRY_API_KEY` | — | API-ключ для доступа |
| `REGISTRY_HMAC_SECRET` | — | HMAC-секрет для подписи запросов |

---

## Отказоустойчивость (UAM Graceful Degradation)

Модуль Registry использует **кэш сессий UAM** для обеспечения бесперебойной работы:

- При каждой успешной валидации сессии через UAM — результат кэшируется **на 15 минут**
- Если UAM временно недоступен — используется закэшированный результат
- Если UAM явно вернул 401 — сессия немедленно удаляется из кэша
- Фоновое обновление кэша происходит каждые **60 секунд** при доступном UAM

> Это означает, что залогиненные пользователи **не вылетят** из Registry, даже если auth.markbase.ru будет недоступен до 15 минут.

Подробнее: см. [UAM Plugin → Отказоустойчивость](../uam/README.md#отказоустойчивость-graceful-degradation)

---

## Changelog

### 1.0.0 (2026-02-07)
- Первый релиз
- Каталог модулей с версиями и статусами
- Генерация API-ключей и HMAC-секретов
- Маршрутизация доменов (resolve)
- HMAC-SHA256 подпись запросов
- Session cache: graceful degradation при недоступности UAM
- Интеграция: JS, Python, PHP, WordPress
