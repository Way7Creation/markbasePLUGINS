# Plugin: Wallet — Балансы и транзакции

> **Версия:** 1.0.0  
> **Slug:** `wallet`  
> **Endpoint:** `https://wallet.markbase.ru`  
> **Port:** 8070

---

## Обзор

Wallet — модуль управления финансами проектов на платформе MarkBase. Обеспечивает хранение баланса, пополнение, списание, историю транзакций и управление платёжными методами.

**Возможности:**
- Создание кошелька для каждого проекта
- Пополнение баланса (topup) через платёжные системы
- Списание средств (charge) за подписки и услуги
- Полная история транзакций с фильтрацией
- Управление платёжными методами (карты, счета)
- Атомарные операции с балансом (защита от двойного списания)

**Принцип:** каждый проект имеет кошелёк с балансом в рублях. При оформлении подписки через Billing средства списываются из Wallet. Пополнение — через привязанные платёжные методы. Все операции атомарны и логируются.

---

## Быстрый старт

```bash
# 1. Создать кошелёк для проекта
curl -X POST https://wallet.markbase.ru/api/wallet/v1/wallet \
  -H "Cookie: uam_session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"PROJECT_UUID","currency":"RUB"}'

# 2. Пополнить баланс
curl -X POST https://wallet.markbase.ru/api/wallet/v1/topup \
  -H "Cookie: uam_session=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"PROJECT_UUID","amount":5000,"payment_method_id":"pm_xxxx"}'

# 3. Проверить баланс
curl https://wallet.markbase.ru/api/wallet/v1/balance?project_id=PROJECT_UUID \
  -H "Cookie: uam_session=YOUR_SESSION"

# 4. Списать средства
curl -X POST https://wallet.markbase.ru/api/wallet/v1/charge \
  -H "X-Api-Key: mk_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"PROJECT_UUID","amount":990,"reason":"subscription:start","idempotency_key":"sub_202602"}'

# 5. Получить историю транзакций
curl "https://wallet.markbase.ru/api/wallet/v1/transactions?project_id=PROJECT_UUID&limit=20" \
  -H "Cookie: uam_session=YOUR_SESSION"

# 6. Получить платёжные методы
curl https://wallet.markbase.ru/api/wallet/v1/payment-methods?project_id=PROJECT_UUID \
  -H "Cookie: uam_session=YOUR_SESSION"
```

---

## 1. Интеграция: JavaScript / Node.js

### Списание за подписку и проверка баланса

```javascript
const axios = require('axios');

const WALLET_URL = process.env.WALLET_URL || 'http://wallet:8070';

// Проверить баланс проекта
async function getBalance(projectId) {
  const { data } = await axios.get(
    `${WALLET_URL}/api/wallet/v1/balance`,
    {
      params: { project_id: projectId },
      headers: { 'X-Api-Key': process.env.REGISTRY_API_KEY }
    }
  );
  return data; // { balance: 4500, currency: "RUB", updated_at: "..." }
}

// Списать средства (charge)
async function chargeWallet(projectId, amount, reason, idempotencyKey) {
  try {
    const { data } = await axios.post(
      `${WALLET_URL}/api/wallet/v1/charge`,
      {
        project_id: projectId,
        amount,
        reason,
        idempotency_key: idempotencyKey
      },
      { headers: { 'X-Api-Key': process.env.REGISTRY_API_KEY } }
    );
    return data; // { transaction_id, balance_after, status: "completed" }
  } catch (err) {
    if (err.response?.status === 402) {
      return { error: 'insufficient_funds', balance: err.response.data.balance };
    }
    throw err;
  }
}

// Пополнить баланс
async function topupWallet(projectId, amount, paymentMethodId, sessionCookie) {
  const { data } = await axios.post(
    `${WALLET_URL}/api/wallet/v1/topup`,
    {
      project_id: projectId,
      amount,
      payment_method_id: paymentMethodId
    },
    { headers: { Cookie: `uam_session=${sessionCookie}` } }
  );
  return data; // { transaction_id, balance_after, status: "completed" }
}

// Пример: списание за подписку с проверкой баланса
async function processSubscriptionPayment(projectId, planPrice, planSlug) {
  const balance = await getBalance(projectId);

  if (balance.balance < planPrice) {
    return {
      success: false,
      error: 'insufficient_funds',
      balance: balance.balance,
      required: planPrice,
      topup_needed: planPrice - balance.balance
    };
  }

  const result = await chargeWallet(
    projectId,
    planPrice,
    `subscription:${planSlug}`,
    `sub_${projectId}_${new Date().toISOString().slice(0, 7)}`
  );

  return { success: true, ...result };
}
```

---

## 2. Интеграция: Python / FastAPI

```python
import httpx
from fastapi import Depends, HTTPException, Request
from typing import Optional

WALLET_URL = "http://wallet:8070"  # Docker
REGISTRY_API_KEY = "mk_xxxx"

async def get_balance(project_id: str) -> dict:
    """Получить баланс кошелька проекта."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{WALLET_URL}/api/wallet/v1/balance",
            params={"project_id": project_id},
            headers={"X-Api-Key": REGISTRY_API_KEY},
            timeout=5
        )
        if resp.status_code == 404:
            raise HTTPException(404, detail="Кошелёк не найден")
        resp.raise_for_status()
        return resp.json()

async def charge_wallet(
    project_id: str,
    amount: int,
    reason: str,
    idempotency_key: Optional[str] = None
) -> dict:
    """Списать средства с кошелька."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{WALLET_URL}/api/wallet/v1/charge",
            json={
                "project_id": project_id,
                "amount": amount,
                "reason": reason,
                "idempotency_key": idempotency_key
            },
            headers={"X-Api-Key": REGISTRY_API_KEY},
            timeout=10
        )
        if resp.status_code == 402:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "insufficient_funds",
                    "balance": resp.json().get("balance"),
                    "required": amount
                }
            )
        if resp.status_code == 404:
            raise HTTPException(404, detail="Кошелёк не найден")
        resp.raise_for_status()
        return resp.json()

async def create_wallet(project_id: str, currency: str = "RUB") -> dict:
    """Создать кошелёк для проекта."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{WALLET_URL}/api/wallet/v1/wallet",
            json={"project_id": project_id, "currency": currency},
            headers={"X-Api-Key": REGISTRY_API_KEY},
            timeout=5
        )
        if resp.status_code == 409:
            raise HTTPException(409, detail="Кошелёк уже существует")
        resp.raise_for_status()
        return resp.json()

# Dependency — проверка достаточности баланса
def require_balance(amount: int):
    async def dependency(project_id: str):
        balance_data = await get_balance(project_id)
        if balance_data["balance"] < amount:
            raise HTTPException(402, detail="Недостаточно средств")
        return balance_data
    return Depends(dependency)

# Использование
from fastapi import FastAPI
app = FastAPI()

@app.post("/api/internal/charge-subscription")
async def charge_subscription(project_id: str, plan_slug: str, amount: int):
    result = await charge_wallet(
        project_id,
        amount,
        f"subscription:{plan_slug}",
        f"sub_{project_id}_{plan_slug}"
    )
    return {"status": "charged", "transaction_id": result["transaction_id"]}
```

---

## 3. Интеграция: PHP

```php
<?php
define('WALLET_URL', 'https://wallet.markbase.ru');

/**
 * Получить баланс проекта.
 */
function wallet_get_balance(string $projectId): ?array {
    $url = WALLET_URL . '/api/wallet/v1/balance?project_id=' . urlencode($projectId);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-Api-Key: ' . REGISTRY_API_KEY],
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $code === 200 ? json_decode($response, true) : null;
}

/**
 * Списать средства с кошелька.
 */
function wallet_charge(string $projectId, int $amount, string $reason, string $idempotencyKey = ''): array {
    $ch = curl_init(WALLET_URL . '/api/wallet/v1/charge');
    $payload = json_encode([
        'project_id'      => $projectId,
        'amount'          => $amount,
        'reason'          => $reason,
        'idempotency_key' => $idempotencyKey ?: uniqid('chg_')
    ]);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Api-Key: ' . REGISTRY_API_KEY
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 10
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);
    $data['_http_code'] = $code;

    return $data;
}

/**
 * Пополнить баланс.
 */
function wallet_topup(string $projectId, int $amount, string $paymentMethodId): array {
    $ch = curl_init(WALLET_URL . '/api/wallet/v1/topup');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Cookie: uam_session=' . ($_COOKIE['uam_session'] ?? '')
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'project_id'        => $projectId,
            'amount'            => $amount,
            'payment_method_id' => $paymentMethodId
        ]),
        CURLOPT_TIMEOUT => 10
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);
    $data['_http_code'] = $code;

    return $data;
}

// Использование
$balance = wallet_get_balance($projectId);
if ($balance && $balance['balance'] >= 990) {
    $result = wallet_charge($projectId, 990, 'subscription:start');
    if ($result['_http_code'] === 200) {
        echo 'Списание успешно! Новый баланс: ' . $result['balance_after'] . ' ₽';
    }
} else {
    echo 'Недостаточно средств. Баланс: ' . ($balance['balance'] ?? 0) . ' ₽';
}
```

---

## 4. Интеграция: WordPress (WooCommerce)

### Файл плагина: `markbase-wallet.php`

```php
<?php
/**
 * Plugin Name: MarkBase Wallet
 * Description: Оплата через MarkBase Wallet + интеграция с WooCommerce
 * Version: 1.0.0
 * Author: MarkBase
 */

if (!defined('ABSPATH')) exit;

define('MB_WALLET_URL', 'https://wallet.markbase.ru');

// === Получить баланс ===
function mb_wallet_get_balance(string $projectId): ?array {
    $cookie = $_COOKIE['uam_session'] ?? '';
    if (!$cookie) return null;

    $response = wp_remote_get(
        MB_WALLET_URL . '/api/wallet/v1/balance?project_id=' . urlencode($projectId),
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

// === Списание средств ===
function mb_wallet_charge(string $projectId, int $amount, string $reason): ?array {
    $response = wp_remote_post(
        MB_WALLET_URL . '/api/wallet/v1/charge',
        [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Api-Key'    => get_option('mb_registry_api_key', '')
            ],
            'body' => wp_json_encode([
                'project_id'      => $projectId,
                'amount'          => $amount,
                'reason'          => $reason,
                'idempotency_key' => 'woo_' . uniqid()
            ]),
            'timeout' => 10
        ]
    );

    if (is_wp_error($response)) return null;

    return json_decode(wp_remote_retrieve_body($response), true);
}

// === WooCommerce Payment Gateway ===
add_action('plugins_loaded', function() {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_Gateway_MarkBase_Wallet extends WC_Payment_Gateway {
        public function __construct() {
            $this->id                 = 'markbase_wallet';
            $this->method_title       = 'MarkBase Wallet';
            $this->method_description = 'Оплата с баланса MarkBase Wallet';
            $this->has_fields         = false;
            $this->title              = 'MarkBase Wallet';
            $this->description        = 'Списание с баланса вашего кошелька MarkBase';

            $this->init_form_fields();
            $this->init_settings();

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        }

        public function init_form_fields() {
            $this->form_fields = [
                'enabled' => [
                    'title'   => 'Включить',
                    'type'    => 'checkbox',
                    'default' => 'yes'
                ],
                'project_id' => [
                    'title'       => 'Project ID',
                    'type'        => 'text',
                    'description' => 'UUID проекта в MarkBase'
                ]
            ];
        }

        public function process_payment($order_id) {
            $order = wc_get_order($order_id);
            $project_id = $this->get_option('project_id');
            $amount = intval($order->get_total());

            $result = mb_wallet_charge($project_id, $amount, 'woocommerce:order_' . $order_id);

            if ($result && isset($result['transaction_id'])) {
                $order->payment_complete($result['transaction_id']);
                $order->add_order_note('Оплачено через MarkBase Wallet. Транзакция: ' . $result['transaction_id']);

                return [
                    'result'   => 'success',
                    'redirect' => $this->get_return_url($order)
                ];
            }

            wc_add_notice('Не удалось списать средства. Проверьте баланс кошелька.', 'error');
            return ['result' => 'fail'];
        }
    }

    add_filter('woocommerce_payment_gateways', function($gateways) {
        $gateways[] = 'WC_Gateway_MarkBase_Wallet';
        return $gateways;
    });
});

// === Шорткод: баланс кошелька ===
add_shortcode('markbase_balance', function($atts) {
    $atts = shortcode_atts(['project_id' => ''], $atts);
    if (!$atts['project_id']) return '<p>Укажите project_id</p>';

    $data = mb_wallet_get_balance($atts['project_id']);
    if (!$data) return '<p>Кошелёк не найден. <a href="https://wallet.markbase.ru">Создать</a></p>';

    return '<div class="markbase-balance">'
         . '<span class="balance-amount">' . number_format($data['balance'], 0, '', ' ') . ' ₽</span>'
         . ' <a href="https://wallet.markbase.ru/topup?project_id=' . esc_attr($atts['project_id'])
         . '" class="button">Пополнить</a></div>';
});

// === Страница настроек ===
add_action('admin_menu', function() {
    add_options_page('MarkBase Wallet', 'MarkBase Wallet', 'manage_options', 'markbase-wallet', function() {
        echo '<div class="wrap">';
        echo '<h1>MarkBase Wallet</h1>';
        echo '<table class="form-table">';
        echo '<tr><th>Wallet URL</th><td>' . MB_WALLET_URL . '</td></tr>';
        echo '<tr><th>Шорткоды</th><td><code>[markbase_balance project_id="..."]</code></td></tr>';
        echo '<tr><th>WooCommerce</th><td>Настройки → Платежи → MarkBase Wallet</td></tr>';
        echo '</table></div>';
    });
});
```

### Установка WordPress-плагина

1. Скопируйте `markbase-wallet.php` в `/wp-content/plugins/markbase-wallet/`
2. Активируйте в **Плагины → MarkBase Wallet**
3. Настройте WooCommerce: **WooCommerce → Настройки → Платежи → MarkBase Wallet**
4. Шорткод `[markbase_balance project_id="UUID"]` — отображение баланса

---

## API Reference

| Метод | Эндпоинт | Параметры | Описание |
|-------|----------|-----------|----------|
| POST | `/api/wallet/v1/wallet` | `{project_id, currency}` | Создать кошелёк для проекта |
| GET | `/api/wallet/v1/wallet` | `?project_id=UUID` | Получить информацию о кошельке |
| GET | `/api/wallet/v1/balance` | `?project_id=UUID` | Текущий баланс проекта |
| POST | `/api/wallet/v1/topup` | `{project_id, amount, payment_method_id}` | Пополнить баланс |
| POST | `/api/wallet/v1/charge` | `{project_id, amount, reason, idempotency_key}` | Списать средства |
| GET | `/api/wallet/v1/transactions` | `?project_id=UUID&limit=20&offset=0&type=charge` | История транзакций |
| GET | `/api/wallet/v1/payment-methods` | `?project_id=UUID` | Список платёжных методов |
| GET | `/api/wallet/v1/health` | — | Health check модуля |

### Ответ `/balance`

```json
{
  "project_id": "PROJECT_UUID",
  "balance": 4500,
  "currency": "RUB",
  "updated_at": "2026-02-07T12:00:00Z"
}
```

### Ответ `/charge`

```json
{
  "transaction_id": "txn_abc123",
  "project_id": "PROJECT_UUID",
  "type": "charge",
  "amount": 990,
  "reason": "subscription:start",
  "balance_after": 3510,
  "status": "completed",
  "created_at": "2026-02-07T12:01:00Z"
}
```

### Ответ `/transactions`

```json
{
  "transactions": [
    {
      "transaction_id": "txn_abc123",
      "type": "charge",
      "amount": 990,
      "reason": "subscription:start",
      "balance_after": 3510,
      "created_at": "2026-02-07T12:01:00Z"
    },
    {
      "transaction_id": "txn_xyz789",
      "type": "topup",
      "amount": 5000,
      "reason": "manual_topup",
      "balance_after": 4500,
      "created_at": "2026-02-07T11:00:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

## Коды ошибок

| HTTP код | Ошибка | Описание |
|----------|--------|----------|
| 402 | `insufficient_funds` | Недостаточно средств на балансе для списания |
| 404 | `wallet_not_found` | Кошелёк для указанного проекта не найден |
| 409 | `wallet_already_exists` | Кошелёк для этого проекта уже создан |
| 400 | `invalid_amount` | Сумма должна быть положительным числом |
| 400 | `missing_idempotency_key` | Для charge требуется idempotency_key |
| 401 | `unauthorized` | Отсутствует или невалидная сессия / API-ключ |
| 429 | `rate_limited` | Превышен лимит запросов |

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `WALLET_URL` | `https://wallet.markbase.ru` | Публичный URL модуля Wallet |

---

## Changelog

### 1.0.0 (2026-02-07)
- Первый релиз
- Создание кошельков для проектов
- Пополнение баланса (topup) через платёжные методы
- Списание средств (charge) с idempotency-защитой
- История транзакций с фильтрацией по типу
- Управление платёжными методами
- Интеграция: JS, Python, PHP, WordPress + WooCommerce
