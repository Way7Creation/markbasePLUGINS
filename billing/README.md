# Plugin: Billing — Тарифные планы и подписки

> **Версия:** 1.0.0  
> **Slug:** `billing`  
> **Endpoint:** `https://billing.markbase.ru`  
> **Port:** 8069

---

## Обзор

Billing — модуль управления тарифными планами, подписками, лимитами и учётом потребления ресурсов на платформе MarkBase.

**Возможности:**
- Каталог тарифных планов (Free, Start, Pro, Enterprise)
- Оформление и управление подписками для проектов
- Учёт потребления ресурсов (usage tracking)
- Проверка лимитов перед созданием ресурсов (limit enforcement)
- Автоматическая блокировка при превышении лимитов

**Принцип:** каждый проект привязан к тарифному плану. Перед созданием ресурса (страница, файл, API-запрос) модуль проверяет, не превышен ли лимит текущего плана. Billing работает совместно с Wallet для обработки платежей.

---

## Тарифные планы

| План | Цена | Страницы | Хранилище | API запросов/мес | Проекты |
|------|------|----------|-----------|------------------|---------|
| **Free** | 0 ₽ | 50 | 100 MB | 1 000 | 1 |
| **Start** | 990 ₽/мес | 500 | 5 GB | 50 000 | 5 |
| **Pro** | 2 990 ₽/мес | 5 000 | 50 GB | 500 000 | 20 |
| **Enterprise** | 9 990 ₽/мес | Безлимит | 500 GB | 5 000 000 | 100 |

---

## Быстрый старт

```bash
# 1. Получить список тарифных планов
curl https://billing.markbase.ru/api/billing/v1/plans

# 2. Оформить подписку на план
curl -X POST https://billing.markbase.ru/api/billing/v1/subscribe \
  -H "Cookie: uam_session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"PROJECT_UUID","plan_slug":"start"}'

# 3. Проверить текущую подписку
curl https://billing.markbase.ru/api/billing/v1/subscription?project_id=PROJECT_UUID \
  -H "Cookie: uam_session=YOUR_SESSION"

# 4. Проверить лимиты перед созданием ресурса
curl "https://billing.markbase.ru/api/billing/v1/limits/check?project_id=PROJECT_UUID&resource=pages&amount=1" \
  -H "X-Api-Key: mk_xxxx"

# 5. Учесть потребление ресурса
curl -X POST https://billing.markbase.ru/api/billing/v1/usage \
  -H "X-Api-Key: mk_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"PROJECT_UUID","resource":"pages","amount":1}'
```

---

## 1. Интеграция: JavaScript / Node.js

### Middleware для проверки лимитов

```javascript
const axios = require('axios');

const BILLING_URL = process.env.BILLING_URL || 'http://billing:8069';

// Проверка лимита перед созданием ресурса
async function checkBillingLimit(projectId, resource, amount = 1) {
  try {
    const { data } = await axios.get(
      `${BILLING_URL}/api/billing/v1/limits/check`,
      {
        params: { project_id: projectId, resource, amount },
        headers: { 'X-Api-Key': process.env.REGISTRY_API_KEY }
      }
    );
    return data; // { allowed: true/false, current: 45, limit: 50, remaining: 5 }
  } catch (err) {
    if (err.response?.status === 403) {
      return { allowed: false, reason: 'limit_exceeded' };
    }
    throw err;
  }
}

// Учёт потребления после создания ресурса
async function reportUsage(projectId, resource, amount = 1) {
  await axios.post(
    `${BILLING_URL}/api/billing/v1/usage`,
    { project_id: projectId, resource, amount },
    { headers: { 'X-Api-Key': process.env.REGISTRY_API_KEY } }
  );
}

// Express middleware — проверка лимита перед созданием страницы
function requireLimit(resource) {
  return async (req, res, next) => {
    const projectId = req.params.projectId || req.body.project_id;

    const check = await checkBillingLimit(projectId, resource);
    if (!check.allowed) {
      return res.status(403).json({
        error: 'limit_exceeded',
        message: `Лимит ${resource} исчерпан (${check.current}/${check.limit})`,
        upgrade_url: 'https://billing.markbase.ru/upgrade'
      });
    }

    // Сохраняем для последующего учёта
    req.billingResource = resource;
    req.billingProjectId = projectId;
    next();
  };
}

// Использование в роутах
const express = require('express');
const app = express();

app.post('/api/pages', requireLimit('pages'), async (req, res) => {
  // Создаём страницу
  const page = await createPage(req.body);

  // Учитываем потребление
  await reportUsage(req.billingProjectId, 'pages', 1);

  res.json(page);
});
```

---

## 2. Интеграция: Python / FastAPI

```python
import httpx
from fastapi import Depends, HTTPException, Request

BILLING_URL = "http://billing:8069"  # Docker
REGISTRY_API_KEY = "mk_xxxx"

async def check_billing_limit(
    project_id: str,
    resource: str,
    amount: int = 1
) -> dict:
    """Проверить лимит перед созданием ресурса."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BILLING_URL}/api/billing/v1/limits/check",
            params={"project_id": project_id, "resource": resource, "amount": amount},
            headers={"X-Api-Key": REGISTRY_API_KEY},
            timeout=5
        )
        if resp.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "limit_exceeded",
                    "message": f"Лимит {resource} исчерпан",
                    "upgrade_url": "https://billing.markbase.ru/upgrade"
                }
            )
        resp.raise_for_status()
        return resp.json()

async def report_usage(project_id: str, resource: str, amount: int = 1):
    """Учесть потребление ресурса."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{BILLING_URL}/api/billing/v1/usage",
            json={"project_id": project_id, "resource": resource, "amount": amount},
            headers={"X-Api-Key": REGISTRY_API_KEY},
            timeout=5
        )

# Dependency для FastAPI
def require_billing_limit(resource: str):
    async def dependency(request: Request, project_id: str):
        result = await check_billing_limit(project_id, resource)
        if not result.get("allowed"):
            raise HTTPException(403, detail="Лимит исчерпан. Обновите тариф.")
        return result
    return Depends(dependency)

# Использование
from fastapi import FastAPI
app = FastAPI()

@app.post("/api/pages")
async def create_page(
    project_id: str,
    billing=require_billing_limit("pages")
):
    page = await do_create_page(project_id)
    await report_usage(project_id, "pages", 1)
    return page
```

---

## 3. Интеграция: PHP

```php
<?php
define('BILLING_URL', 'https://billing.markbase.ru');

/**
 * Проверить лимит ресурса для проекта.
 */
function billing_check_limit(string $projectId, string $resource, int $amount = 1): array {
    $url = BILLING_URL . '/api/billing/v1/limits/check?'
         . http_build_query(['project_id' => $projectId, 'resource' => $resource, 'amount' => $amount]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-Api-Key: ' . REGISTRY_API_KEY],
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);

    if ($code === 403) {
        return ['allowed' => false, 'reason' => 'limit_exceeded', 'data' => $data];
    }

    return $data;
}

/**
 * Получить текущую подписку проекта.
 */
function billing_get_subscription(string $projectId): ?array {
    $url = BILLING_URL . '/api/billing/v1/subscription?project_id=' . urlencode($projectId);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Cookie: uam_session=' . ($_COOKIE['uam_session'] ?? '')
        ],
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $code === 200 ? json_decode($response, true) : null;
}

/**
 * Учесть потребление ресурса.
 */
function billing_report_usage(string $projectId, string $resource, int $amount = 1): bool {
    $ch = curl_init(BILLING_URL . '/api/billing/v1/usage');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Api-Key: ' . REGISTRY_API_KEY
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'project_id' => $projectId,
            'resource'   => $resource,
            'amount'     => $amount
        ]),
        CURLOPT_TIMEOUT => 5
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $code === 200;
}

// Использование
$check = billing_check_limit($projectId, 'pages', 1);
if (!$check['allowed']) {
    http_response_code(403);
    die('Лимит страниц исчерпан. Обновите тариф.');
}
```

---

## 4. Интеграция: WordPress

### Файл плагина: `markbase-billing.php`

```php
<?php
/**
 * Plugin Name: MarkBase Billing
 * Description: Проверка подписки и лимитов через MarkBase Billing
 * Version: 1.0.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_BILLING_URL', 'https://billing.markbase.ru');

// === Получить подписку текущего проекта ===
function mb_billing_get_subscription(string $projectId): ?array {
    $cookie = $_COOKIE['uam_session'] ?? '';
    if (!$cookie) return null;

    $response = wp_remote_get(
        MB_BILLING_URL . '/api/billing/v1/subscription?project_id=' . urlencode($projectId),
        [
            'cookies' => [new WP_Http_Cookie([
                'name'  => 'uam_session',
                'value' => $cookie
            ])],
            'timeout' => 5
        ]
    );

    if (is_wp_error($response)) return null;
    if (wp_remote_retrieve_response_code($response) !== 200) return null;

    return json_decode(wp_remote_retrieve_body($response), true);
}

// === Проверить лимит ===
function mb_billing_check_limit(string $projectId, string $resource, int $amount = 1): array {
    $response = wp_remote_get(
        MB_BILLING_URL . '/api/billing/v1/limits/check?' . http_build_query([
            'project_id' => $projectId,
            'resource'   => $resource,
            'amount'     => $amount
        ]),
        [
            'headers' => ['X-Api-Key' => get_option('mb_registry_api_key', '')],
            'timeout' => 5
        ]
    );

    if (is_wp_error($response)) {
        return ['allowed' => false, 'reason' => 'network_error'];
    }

    return json_decode(wp_remote_retrieve_body($response), true) ?: ['allowed' => false];
}

// === Шорткод: информация о текущем плане ===
add_shortcode('markbase_plan', function($atts) {
    $atts = shortcode_atts(['project_id' => ''], $atts);
    if (!$atts['project_id']) return '<p>Укажите project_id</p>';

    $sub = mb_billing_get_subscription($atts['project_id']);
    if (!$sub) return '<p>Подписка не найдена. <a href="https://billing.markbase.ru">Выбрать план</a></p>';

    $html  = '<div class="markbase-plan-info">';
    $html .= '<h3>Ваш план: ' . esc_html($sub['plan_name']) . '</h3>';
    $html .= '<p>Статус: <strong>' . esc_html($sub['status']) . '</strong></p>';
    $html .= '<p>Страниц: ' . intval($sub['usage']['pages']) . ' / ' . intval($sub['limits']['pages']) . '</p>';
    $html .= '<p>Хранилище: ' . esc_html($sub['usage']['storage']) . ' / ' . esc_html($sub['limits']['storage']) . '</p>';
    $html .= '<p>API запросов: ' . intval($sub['usage']['api_requests']) . ' / ' . intval($sub['limits']['api_requests']) . '</p>';
    if ($sub['plan_slug'] !== 'enterprise') {
        $html .= '<p><a href="https://billing.markbase.ru/upgrade?project_id=' . esc_attr($atts['project_id'])
               . '" class="button">Обновить план</a></p>';
    }
    $html .= '</div>';

    return $html;
});

// === Список доступных планов (шорткод) ===
add_shortcode('markbase_plans', function() {
    $response = wp_remote_get(MB_BILLING_URL . '/api/billing/v1/plans', ['timeout' => 5]);
    if (is_wp_error($response)) return '<p>Не удалось загрузить планы.</p>';

    $plans = json_decode(wp_remote_retrieve_body($response), true);
    if (!$plans) return '<p>Планы не найдены.</p>';

    $html = '<div class="markbase-plans-grid">';
    foreach ($plans as $plan) {
        $price = $plan['price'] > 0 ? number_format($plan['price'], 0, '', ' ') . ' ₽/мес' : 'Бесплатно';
        $html .= '<div class="markbase-plan-card">';
        $html .= '<h3>' . esc_html($plan['name']) . '</h3>';
        $html .= '<p class="price">' . $price . '</p>';
        $html .= '<ul>';
        $html .= '<li>Страниц: ' . esc_html($plan['limits']['pages']) . '</li>';
        $html .= '<li>Хранилище: ' . esc_html($plan['limits']['storage']) . '</li>';
        $html .= '<li>API: ' . esc_html($plan['limits']['api_requests']) . '/мес</li>';
        $html .= '</ul>';
        $html .= '</div>';
    }
    $html .= '</div>';

    return $html;
});

// === Страница настроек ===
add_action('admin_menu', function() {
    add_options_page('MarkBase Billing', 'MarkBase Billing', 'manage_options', 'markbase-billing', function() {
        echo '<div class="wrap">';
        echo '<h1>MarkBase Billing</h1>';
        echo '<table class="form-table">';
        echo '<tr><th>Billing URL</th><td>' . MB_BILLING_URL . '</td></tr>';
        echo '<tr><th>Шорткоды</th><td><code>[markbase_plan project_id="..."]</code>, <code>[markbase_plans]</code></td></tr>';
        echo '</table></div>';
    });
});
```

### Установка WordPress-плагина

1. Скопируйте `markbase-billing.php` в `/wp-content/plugins/markbase-billing/`
2. Активируйте в **Плагины → MarkBase Billing**
3. Шорткод `[markbase_plan project_id="UUID"]` — информация о текущем плане
4. Шорткод `[markbase_plans]` — сетка доступных планов

---

## API Reference

| Метод | Эндпоинт | Параметры | Описание |
|-------|----------|-----------|----------|
| GET | `/api/billing/v1/plans` | — | Список всех тарифных планов |
| POST | `/api/billing/v1/subscribe` | `{project_id, plan_slug}` | Оформить подписку на план |
| GET | `/api/billing/v1/subscription` | `?project_id=UUID` | Текущая подписка проекта |
| POST | `/api/billing/v1/usage` | `{project_id, resource, amount}` | Учесть потребление ресурса |
| GET | `/api/billing/v1/limits/check` | `?project_id=UUID&resource=pages&amount=1` | Проверить лимит перед действием |
| GET | `/api/billing/v1/health` | — | Health check модуля |

### Ответ `/plans`

```json
[
  {
    "slug": "free",
    "name": "Free",
    "price": 0,
    "currency": "RUB",
    "limits": { "pages": 50, "storage_mb": 100, "api_requests": 1000, "projects": 1 }
  },
  {
    "slug": "start",
    "name": "Start",
    "price": 990,
    "currency": "RUB",
    "limits": { "pages": 500, "storage_mb": 5120, "api_requests": 50000, "projects": 5 }
  }
]
```

### Ответ `/limits/check`

```json
{
  "allowed": true,
  "resource": "pages",
  "current": 42,
  "limit": 500,
  "remaining": 458
}
```

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `BILLING_URL` | `https://billing.markbase.ru` | Публичный URL модуля Billing |

---

## Changelog

### 1.0.0 (2026-02-07)
- Первый релиз
- Тарифные планы: Free, Start, Pro, Enterprise
- Оформление и управление подписками
- Учёт потребления ресурсов (usage tracking)
- Проверка лимитов (limit enforcement)
- Интеграция: JS, Python, PHP, WordPress
