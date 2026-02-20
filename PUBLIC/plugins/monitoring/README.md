# Plugin: Monitoring — Мониторинг

> **Версия:** 1.0.0  
> **Slug:** `monitoring`  
> **Endpoint:** `https://monitoring.markbase.ru`  
> **Порт:** 8063

---

## Обзор

Monitoring — централизованный сервис мониторинга платформы MarkBase. Собирает метрики, проводит health checks, управляет алертами и хранит логи всех модулей.

**Возможности:**
- **Health Checks** — проверка доступности всех зарегистрированных модулей
- **Метрики** — сбор и хранение пользовательских метрик (counters, gauges, histograms)
- **Алерты** — уведомления при превышении пороговых значений
- **Логи** — централизованное хранилище логов всех сервисов

---

## Быстрый старт

### 1. Отправить метрику

```bash
curl -X POST https://monitoring.markbase.ru/api/monitoring/v1/metrics \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "http_requests_total",
    "type": "counter",
    "value": 1,
    "labels": {"method": "GET", "path": "/api/orders", "status": "200"}
  }'
```

### 2. Запустить health check

```bash
curl -X POST https://monitoring.markbase.ru/api/monitoring/v1/healthcheck/run \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"targets": ["uam", "security", "registry"]}'
```

Ответ:
```json
{
  "results": [
    {"module": "uam", "status": "healthy", "response_ms": 45},
    {"module": "security", "status": "healthy", "response_ms": 32},
    {"module": "registry", "status": "healthy", "response_ms": 28}
  ],
  "overall": "healthy"
}
```

### 3. Отправить лог

```bash
curl -X POST https://monitoring.markbase.ru/api/monitoring/v1/logs \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "module": "my-app",
    "message": "Database connection timeout",
    "meta": {"host": "db-01", "timeout_ms": 5000}
  }'
```

---

## 1. Интеграция: JavaScript / Node.js

### Отправка метрик и логов

```javascript
const axios = require('axios');

const MONITORING_URL = process.env.MONITORING_URL || 'https://monitoring.markbase.ru';
const MONITORING_API_KEY = process.env.MONITORING_API_KEY;
const MODULE_NAME = 'my-node-app';

const monitoringHeaders = {
  'X-API-Key': MONITORING_API_KEY,
  'Content-Type': 'application/json'
};

// Отправка метрики
async function sendMetric(name, type, value, labels = {}) {
  try {
    await axios.post(
      `${MONITORING_URL}/api/monitoring/v1/metrics`,
      { name, type, value, labels, module: MODULE_NAME },
      { headers: monitoringHeaders, timeout: 5000 }
    );
  } catch (err) {
    console.error('Failed to send metric:', err.message);
  }
}

// Отправка лога
async function sendLog(level, message, meta = {}) {
  try {
    await axios.post(
      `${MONITORING_URL}/api/monitoring/v1/logs`,
      { level, module: MODULE_NAME, message, meta },
      { headers: monitoringHeaders, timeout: 5000 }
    );
  } catch (err) {
    console.error('Failed to send log:', err.message);
  }
}

// Express middleware: автоматические метрики запросов
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    sendMetric('http_request_duration_ms', 'histogram', duration, {
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode.toString()
    });
    sendMetric('http_requests_total', 'counter', 1, {
      method: req.method,
      status: res.statusCode.toString()
    });
  });

  next();
}

// Использование
const express = require('express');
const app = express();

app.use(metricsMiddleware);

app.get('/api/orders', (req, res) => {
  res.json({ orders: [] });
});

// Логирование ошибок
app.use((err, req, res, next) => {
  sendLog('error', err.message, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Health check endpoint для Monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', module: MODULE_NAME, uptime: process.uptime() });
});
```

### Получение алертов

```javascript
// Получить активные алерты
async function getAlerts(status = 'active') {
  const { data } = await axios.get(
    `${MONITORING_URL}/api/monitoring/v1/alerts`,
    { params: { status }, headers: monitoringHeaders }
  );
  return data; // [{ id, severity, module, message, created_at }, ...]
}
```

---

## 2. Интеграция: Python / FastAPI

```python
import httpx
import time
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

MONITORING_URL = "https://monitoring.markbase.ru"
MONITORING_API_KEY = "mk_mon_abc123..."
MODULE_NAME = "my-python-app"

headers = {"X-API-Key": MONITORING_API_KEY, "Content-Type": "application/json"}


# Отправка метрики
async def send_metric(name: str, metric_type: str, value: float, labels: dict = None):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{MONITORING_URL}/api/monitoring/v1/metrics",
                json={
                    "name": name, "type": metric_type,
                    "value": value, "labels": labels or {},
                    "module": MODULE_NAME
                },
                headers=headers, timeout=5
            )
    except httpx.HTTPError:
        pass


# Отправка лога
async def send_log(level: str, message: str, meta: dict = None):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{MONITORING_URL}/api/monitoring/v1/logs",
                json={
                    "level": level, "module": MODULE_NAME,
                    "message": message, "meta": meta or {}
                },
                headers=headers, timeout=5
            )
    except httpx.HTTPError:
        pass


# Middleware: метрики запросов
class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        await send_metric("http_request_duration_ms", "histogram", duration_ms, {
            "method": request.method,
            "path": request.url.path,
            "status": str(response.status_code)
        })
        await send_metric("http_requests_total", "counter", 1, {
            "method": request.method,
            "status": str(response.status_code)
        })

        return response


# Использование
app = FastAPI()
app.add_middleware(MetricsMiddleware)


@app.get("/health")
async def health():
    return {"status": "healthy", "module": MODULE_NAME}


@app.get("/api/orders")
async def get_orders():
    await send_log("info", "Orders requested")
    return {"orders": []}
```

### Django — отправка метрик

```python
# middleware.py
import httpx
import time

MONITORING_URL = "https://monitoring.markbase.ru"
MONITORING_API_KEY = "mk_mon_abc123..."
headers = {"X-API-Key": MONITORING_API_KEY, "Content-Type": "application/json"}

class MonitoringMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.time()
        response = self.get_response(request)
        duration_ms = (time.time() - start) * 1000

        # Асинхронная отправка через httpx (fire-and-forget)
        try:
            httpx.post(
                f"{MONITORING_URL}/api/monitoring/v1/metrics",
                json={
                    "name": "http_request_duration_ms",
                    "type": "histogram",
                    "value": duration_ms,
                    "labels": {
                        "method": request.method,
                        "path": request.path,
                        "status": str(response.status_code)
                    },
                    "module": "my-django-app"
                },
                headers=headers, timeout=3
            )
        except Exception:
            pass

        return response
```

---

## 3. Интеграция: PHP / WordPress

### PHP: базовые функции

```php
<?php
define('MONITORING_URL', 'https://monitoring.markbase.ru');
define('MONITORING_API_KEY', 'mk_mon_abc123...');
define('MONITORING_MODULE', 'my-php-app');

function monitoring_send(string $endpoint, array $data): void {
    $ch = curl_init(MONITORING_URL . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . MONITORING_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 5
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// Отправить метрику
function monitoring_metric(string $name, string $type, float $value, array $labels = []): void {
    monitoring_send('/api/monitoring/v1/metrics', [
        'name' => $name, 'type' => $type,
        'value' => $value, 'labels' => $labels,
        'module' => MONITORING_MODULE
    ]);
}

// Отправить лог
function monitoring_log(string $level, string $message, array $meta = []): void {
    monitoring_send('/api/monitoring/v1/logs', [
        'level' => $level, 'module' => MONITORING_MODULE,
        'message' => $message, 'meta' => $meta
    ]);
}

// Использование
monitoring_metric('page_views', 'counter', 1, ['page' => '/home']);
monitoring_log('error', 'Database connection failed', ['host' => 'db-01']);
```

### WordPress-плагин: `markbase-monitoring.php`

```php
<?php
/**
 * Plugin Name: MarkBase Monitoring
 * Description: Логирование ошибок и метрик WordPress в MarkBase Monitoring
 * Version: 1.0.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_MONITORING_URL', 'https://monitoring.markbase.ru');
define('MB_MONITORING_API_KEY', get_option('mb_monitoring_api_key', ''));

// === Перехват PHP-ошибок ===
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) return false;

    $levels = [E_ERROR => 'error', E_WARNING => 'warning', E_NOTICE => 'info'];
    $level = $levels[$errno] ?? 'warning';

    wp_remote_post(MB_MONITORING_URL . '/api/monitoring/v1/logs', [
        'headers' => [
            'X-API-Key' => MB_MONITORING_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'level' => $level,
            'module' => 'wordpress',
            'message' => $errstr,
            'meta' => ['file' => $errfile, 'line' => $errline]
        ]),
        'timeout' => 3,
        'blocking' => false
    ]);

    return false; // Продолжить стандартную обработку
});

// === Метрика: время загрузки страницы ===
add_action('shutdown', function() {
    if (!defined('MB_MONITORING_API_KEY') || !MB_MONITORING_API_KEY) return;

    $duration = (microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']) * 1000;

    wp_remote_post(MB_MONITORING_URL . '/api/monitoring/v1/metrics', [
        'headers' => [
            'X-API-Key' => MB_MONITORING_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'name' => 'wp_page_load_ms',
            'type' => 'histogram',
            'value' => round($duration, 2),
            'labels' => [
                'path' => $_SERVER['REQUEST_URI'] ?? '/',
                'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET'
            ],
            'module' => 'wordpress'
        ]),
        'timeout' => 3,
        'blocking' => false
    ]);
});

// === Метрика: количество активных плагинов ===
add_action('admin_init', function() {
    static $sent = false;
    if ($sent) return;
    $sent = true;

    $plugins = get_option('active_plugins', []);
    wp_remote_post(MB_MONITORING_URL . '/api/monitoring/v1/metrics', [
        'headers' => [
            'X-API-Key' => MB_MONITORING_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'name' => 'wp_active_plugins',
            'type' => 'gauge',
            'value' => count($plugins),
            'module' => 'wordpress'
        ]),
        'timeout' => 3,
        'blocking' => false
    ]);
});

// === Страница настроек ===
add_action('admin_menu', function() {
    add_options_page('MarkBase Monitoring', 'MarkBase Monitoring', 'manage_options', 'markbase-monitoring', function() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('mb_monitoring_save')) {
            update_option('mb_monitoring_api_key', sanitize_text_field($_POST['api_key']));
            echo '<div class="updated"><p>Сохранено.</p></div>';
        }
        $key = get_option('mb_monitoring_api_key', '');
        echo '<div class="wrap"><h1>MarkBase Monitoring</h1>';
        echo '<form method="post">';
        wp_nonce_field('mb_monitoring_save');
        echo '<table class="form-table">';
        echo '<tr><th>API Key</th><td><input type="text" name="api_key" value="' . esc_attr($key) . '" class="regular-text" /></td></tr>';
        echo '<tr><th>Monitoring URL</th><td>' . MB_MONITORING_URL . '</td></tr>';
        echo '</table>';
        submit_button('Сохранить');
        echo '</form></div>';
    });
});
```

### Установка

1. Скопируйте `markbase-monitoring.php` в `/wp-content/plugins/markbase-monitoring/`
2. Активируйте в **Плагины → MarkBase Monitoring**
3. Укажите API-ключ в **Настройки → MarkBase Monitoring**

---

## API Reference

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/monitoring/v1/healthcheck/run` | Запустить health check: `{targets: ["uam", ...]}` |
| GET | `/api/monitoring/v1/healthcheck` | Получить результаты последних проверок |
| POST | `/api/monitoring/v1/metrics` | Отправить метрику: `{name, type, value, labels}` |
| GET | `/api/monitoring/v1/alerts` | Получить алерты: `?status=active&severity=critical` |
| POST | `/api/monitoring/v1/logs` | Отправить лог: `{level, module, message, meta}` |
| GET | `/api/monitoring/v1/health` | Health check самого сервиса |

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `MONITORING_URL` | `https://monitoring.markbase.ru` | Публичный URL сервиса |
| `MONITORING_PORT` | `8063` | Порт сервиса |
| `MONITORING_API_KEY` | — | API-ключ для доступа |
| `HEALTHCHECK_INTERVAL` | `60` | Интервал автоматических проверок (сек) |
| `LOG_RETENTION_DAYS` | `30` | Время хранения логов (дней) |

---

## Отказоустойчивость (UAM Graceful Degradation)

Модуль Monitoring использует **кэш сессий UAM** для обеспечения бесперебойной работы:

- При каждой успешной валидации сессии через UAM — результат кэшируется **на 15 минут**
- Если UAM временно недоступен — используется закэшированный результат
- Если UAM явно вернул 401 — сессия немедленно удаляется из кэша
- Фоновое обновление кэша происходит каждые **60 секунд** при доступном UAM

> Залогиненные пользователи **не вылетят** из Monitoring при кратковременных проблемах auth.markbase.ru.

Подробнее: см. [UAM Plugin → Отказоустойчивость](../uam/README.md#отказоустойчивость-graceful-degradation)

---

## Changelog

### 1.0.0 (2026-02-07)
- Первый релиз
- Health checks для всех зарегистрированных модулей
- Сбор метрик: counter, gauge, histogram
- Система алертов по порогам
- Централизованные логи с уровнями (debug, info, warning, error, critical)
- Middleware примеры: Express, FastAPI, Django
- WordPress-плагин: перехват ошибок, метрики загрузки страниц
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

