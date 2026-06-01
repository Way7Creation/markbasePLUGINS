# Plugin: Captcha — Защита форм от ботов

> **Версия:** 1.1.0
> **Slug:** `captcha`
> **Домен:** `captcha.markbase.ru`
> **Порт:** 8079
> **Провайдер по умолчанию:** Собственная капча (MarkBase Custom)

---

## Обзор

MarkBase Captcha — универсальный сервис защиты любых форм от ботов, спама и автоматических действий. Работает на `captcha.markbase.ru` и доступен для встраивания на **любой сайт** через виджет.

**3 провайдера:**
| # | Провайдер | По умолчанию | Требует внешний сервис | Описание |
|---|-----------|:---:|:---:|-----------|
| 1 | **MarkBase Custom** | ✅ | Нет | SVG-капча с искажённым текстом/математикой |
| 2 | **Яндекс SmartCaptcha** | — | Да | Невидимая проверка через Яндекс.Облако |
| 3 | **Google reCAPTCHA v3** | — | Да | Невидимая проверка со скором через Google |

**Ключевые возможности:**
- 🔑 **Система ключей** — каждый проект получает свою пару `site_key` / `secret_key`
- 🌐 **Виджет для любого сайта** — `<script src="https://captcha.markbase.ru/widget.js">`
- 🛡️ **Fail-Open стратегия** — при недоступности сервиса формы продолжают работать
- 📊 **Статистика** — сколько проверок, успешных/неуспешных, по провайдерам
- 🔄 **Fallback** — если основной провайдер недоступен, автоматически используется запасной
- 🔒 **Домен-фильтрация** — ключи работают только на разрешённых доменах
- ⚡ **Кэширование** — проекты кэшируются для быстрого ответа

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                 captcha.markbase.ru (8079)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Custom       │  │  Яндекс      │  │  Google      │  │
│  │  (по умолч.)  │  │  SmartCaptcha│  │  reCAPTCHA   │  │
│  │  SVG + verify │  │  validate API│  │  siteverify  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                        │                                 │
│              ┌─────────▼──────────┐                      │
│              │   Verification     │                      │
│              │   Service          │                      │
│              │   (единая точка)   │                      │
│              └─────────┬──────────┘                      │
│                        │                                 │
│              ┌─────────▼──────────┐                      │
│              │   PostgreSQL       │                      │
│              │   projects,        │                      │
│              │   challenges,      │                      │
│              │   verifications    │                      │
│              └────────────────────┘                      │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                  │
    ┌────▼────┐      ┌────▼────┐       ┌────▼────┐
    │  UAM    │      │  Ваш    │       │  Любой  │
    │  (вход/ │      │  сайт   │       │  сайт   │
    │  регист)│      │  (чаты/ │       │  (widget│
    │         │      │  формы) │       │  .js)   │
    └─────────┘      └─────────┘       └─────────┘
```

### Порядок провайдеров (приоритет)

```
1. Собственная капча (custom) — по умолчанию, всегда доступна
       ↓ (если настроен yandex)
2. Яндекс SmartCaptcha — если есть yandex_site_key + yandex_secret_key
       ↓ (если настроен google)
3. Google reCAPTCHA — если есть google_site_key + google_secret_key
       ↓ (при ошибке любого провайдера)
4. Fallback → другой провайдер
       ↓ (если всё недоступно)
5. Fail-Open → пропускаем + логируем
```

### Fail-Open стратегия

| Ситуация | Поведение | Логирование |
|----------|-----------|-------------|
| Провайдер доступен, токен верный | ✅ Пропускаем | ✅ Лог |
| Провайдер доступен, токен неверный | ❌ Блокируем | ✅ Лог |
| Провайдер недоступен (timeout) | ⚠️ Пропускаем (fail-open) | ✅ Лог + alert |
| Captcha Service не работает | ⚠️ Пропускаем (fail-open) | ✅ Лог + alert |
| Токен не передан (нет капчи) | ⚠️ Пропускаем (fail-open) | ✅ Лог |

---

## Быстрый старт

### 1. Встроить виджет на сайт (5 минут)

```html
<!-- Шаг 1: Контейнер -->
<div id="mb-captcha"></div>

<!-- Шаг 2: Скрипт -->
<script src="https://captcha.markbase.ru/widget.js"></script>

<!-- Шаг 3: Инициализация -->
<script>
  MBCaptcha.render('#mb-captcha', {
    siteKey: 'mb_cap_live_xxxxxxxxxxxx',  // Ваш публичный ключ
    provider: 'custom',                    // custom | yandex | google
    theme: 'light',                        // light | dark
    lang: 'ru',                            // ru | en
    action: 'contact',                     // Действие (для статистики)
    onVerify: function(result) {
      // result.token — передайте в скрытое поле формы
      document.getElementById('captcha-token').value = result.token;
      document.getElementById('challenge-id').value = result.challengeId || '';
      document.getElementById('captcha-answer').value = result.answer || result.token;
    }
  });
</script>

<!-- В вашей форме: -->
<form method="POST" action="/submit">
  <input type="hidden" id="captcha-token" name="captcha_token" />
  <input type="hidden" id="challenge-id" name="challenge_id" />
  <input type="hidden" id="captcha-answer" name="captcha_answer" />
  <!-- Остальные поля формы -->
  <button type="submit">Отправить</button>
</form>
```

### 2. Проверить на сервере

```javascript
// Node.js
const axios = require('axios');

app.post('/submit', async (req, res) => {
  const { captcha_token, challenge_id, captcha_answer } = req.body;

  try {
    const { data } = await axios.post('https://captcha.markbase.ru/api/captcha/v1/verify', {
      secret_key: 'mb_caps_live_xxxxxxxxxxxx', // Ваш секретный ключ
      provider: 'custom',
      action: 'contact',
      challenge_id,
      answer: captcha_answer
    }, { timeout: 3000 });

    if (!data.success) {
      return res.status(400).json({ error: 'Проверка капчи не пройдена' });
    }

    // Обрабатываем форму...
  } catch (err) {
    // Fail-open: разрешаем если Captcha Service недоступен
    console.warn('Captcha service unavailable:', err.message);
  }
});
```

```php
<?php
// PHP
$token = $_POST['captcha_answer'] ?? '';
$challengeId = $_POST['challenge_id'] ?? '';

$ch = curl_init('https://captcha.markbase.ru/api/captcha/v1/verify');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode([
        'secret_key' => 'mb_caps_live_xxxxxxxxxxxx',
        'provider' => 'custom',
        'action' => 'contact',
        'challenge_id' => $challengeId,
        'answer' => $token
    ]),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT => 3
]);
$response = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200) {
    // Fail-open: Captcha Service недоступен
    error_log("Captcha unavailable, allowing form");
} else {
    $data = json_decode($response, true);
    if ($data['success'] !== true) {
        die('Проверка капчи не пройдена');
    }
}
// Обрабатываем форму...
?>
```

### 3. Получить ключи (API)

Авторизуйтесь через WaySenID, затем:

```bash
curl -X POST https://captcha.markbase.ru/api/captcha/v1/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: uam_session=YOUR_SESSION" \
  -d '{
    "project_name": "Мой сайт",
    "provider": "custom",
    "allowed_domains": ["mysite.ru", ".mysite.ru"],
    "difficulty": "medium"
  }'
```

Ответ:
```json
{
  "project_id": "uuid",
  "site_key": "mb_cap_live_xxxxxxxxxxxx",
  "secret_key": "mb_caps_live_xxxxxxxxxxxx",
  "provider": "custom",
  "widget_code": "<div id=\"mb-captcha\"></div>..."
}
```

---

## Интеграция с UAM (WaySenID)

Капча **автоматически подключена** к UAM:

| Действие | Капча | Стратегия |
|----------|:-----:|-----------|
| Регистрация | ✅ Обязательна | Fail-open |
| Вход (при ≤3 попытках) | 🔄 Условная | Fail-open, только после неудачных попыток |
| Смена пароля | 🔄 Условная | Fail-open |

### Backend middleware

**Файл:** `modules/uam/backend/src/middleware/captcha.js`

```javascript
const { verifyCaptcha } = require('../middleware/captcha');

// Регистрация — капча обязательна
router.post('/register',
  authRateLimiter,
  verifyCaptcha('register'),        // ← Капча
  async (req, res) => { ... }
);

// Вход — капча условная (только если token передан)
router.post('/login',
  authRateLimiter,
  checkBlockedIp,
  checkBruteForce,
  verifyCaptcha('login', { conditional: true }),  // ← Условная капча
  async (req, res) => { ... }
);

// Смена пароля — условная
router.post('/change-password',
  verifyCaptcha('password_change', { conditional: true }),
  async (req, res) => { ... }
);
```

### Frontend компонент (v1.1.0)

**Файл:** `modules/uam/frontend/src/components/Captcha.js`

> **Важно (v1.1.0):** Frontend компонент **НЕ вызывает** `/verify` напрямую. Он только собирает `challengeId` и `answer`, передаёт их в `onVerify`. Верификация происходит **только на backend** при отправке формы. Это исключает двойную верификацию.

```jsx
import Captcha from '../components/Captcha';

// В форме регистрации:
<Captcha
  action="register"
  onVerify={(result) => {
    // result = { success: true, provider: 'custom', challengeId: '...', answer: '...', token: null }
    setCaptchaResult(result);
  }}
  onError={() => setCaptchaResult({ success: true, token: 'fail_open' })}
/>

// При отправке формы передайте на backend:
// { captcha_answer: result.answer, challenge_id: result.challengeId }
// Backend middleware verifyCaptcha() сам проверит через captcha service.
```

> **URL капчи:** Компонент автоматически определяет URL captcha-сервиса:
> - `REACT_APP_CAPTCHA_URL` (env variable, приоритет)
> - `https://captcha.markbase.ru` (для `*.markbase.ru` доменов)
> - Relative URL `/api/captcha/v1/...` (fallback для dev)

---

## API Reference

### Публичные эндпоинты (без авторизации)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `POST` | `/api/captcha/v1/challenge` | Создать челлендж (собственная капча) |
| `POST` | `/api/captcha/v1/verify` | Проверить ответ/токен |
| `GET` | `/api/captcha/v1/config` | Конфигурация провайдера |
| `GET` | `/health` | Health check сервиса |

### Защищённые эндпоинты (с secret_key или авторизацией)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/api/captcha/v1/stats` | Статистика проверок |
| `GET` | `/api/captcha/v1/projects` | Список проектов |
| `POST` | `/api/captcha/v1/projects` | Создать проект |
| `PATCH` | `/api/captcha/v1/projects/:id` | Обновить проект |
| `DELETE` | `/api/captcha/v1/projects/:id` | Удалить проект |
| `POST` | `/api/captcha/v1/projects/:id/regenerate-keys` | Перегенерировать ключи |

### POST /challenge

Создать новый челлендж для собственной капчи.

**Тело:**
```json
{
  "site_key": "mb_cap_live_xxxx",
  "type": "text",
  "difficulty": "medium"
}
```

**Ответ:**
```json
{
  "challenge_id": "uuid",
  "type": "text",
  "difficulty": "medium",
  "image": "data:image/svg+xml;base64,...",
  "hint": "Введите символы с картинки",
  "max_attempts": 3,
  "expires_at": "2026-02-08T12:05:00Z",
  "ttl_seconds": 300
}
```

### POST /verify

Проверить ответ или токен.

**Тело (собственная капча):**
```json
{
  "site_key": "mb_cap_live_xxxx",
  "provider": "custom",
  "action": "register",
  "challenge_id": "uuid",
  "answer": "ABC123"
}
```

**Тело (Яндекс/Google):**
```json
{
  "secret_key": "mb_caps_live_xxxx",
  "provider": "yandex",
  "action": "login",
  "token": "smartcaptcha_token_here"
}
```

**Ответ (успех):**
```json
{
  "success": true,
  "provider": "custom",
  "score": 1.0,
  "action": "register"
}
```

**Ответ (неудача):**
```json
{
  "success": false,
  "provider": "custom",
  "error": "wrong_answer",
  "action": "register",
  "attempts_left": 2
}
```

---

## Конфигурация

### Environment Variables

| Переменная | Описание | По умолчанию |
|-----------|----------|:---:|
| `CAPTCHA_PORT` | Порт сервиса | `8079` |
| `CAPTCHA_PUBLIC_URL` | Публичный URL | `https://captcha.markbase.ru` |
| `CAPTCHA_ENABLED` | Включена ли капча | `true` |
| `CAPTCHA_FAIL_OPEN` | Fail-open стратегия | `true` |
| `CAPTCHA_DB_HOST` | Хост PostgreSQL | `captcha-postgres` |
| `CAPTCHA_DB_NAME` | Имя БД | `captcha_db` |
| `CAPTCHA_DB_USER` | Пользователь БД | `captcha_user` |
| `CAPTCHA_DB_PASSWORD` | Пароль БД | — |
| `UAM_INTERNAL_URL` | URL UAM для аутентификации | `http://uam:8060` (Docker-имя в core стеке) |
| `YANDEX_SMARTCAPTCHA_SITE_KEY` | Публичный ключ Яндекс | — |
| `YANDEX_SMARTCAPTCHA_SECRET_KEY` | Секретный ключ Яндекс | — |
| `GOOGLE_RECAPTCHA_SITE_KEY` | Публичный ключ Google | — |
| `GOOGLE_RECAPTCHA_SECRET_KEY` | Секретный ключ Google | — |
| `CAPTCHA_CORS_ORIGINS` | **Не используется** (deprecated). CORS автоматически разрешает все origins. | — |

**CORS:**
- Виджет капчи предназначен для встраивания на **любой сайт** (как reCAPTCHA / hCaptcha).
- CORS автоматически разрешает все origins. Валидация домена происходит на уровне **проекта** (`allowed_domains` в БД).
- Nginx для captcha.markbase.ru **НЕ ставит** CORS-заголовки — их ставит только Express middleware.
- Ошибка «multiple values» означает, что CORS-заголовок ставится в двух местах — исправьте Nginx.
- Подробнее: [MARKBASE_PLUGINS_OUR_SIDE.md](../../MARKBASE_PLUGINS_OUR_SIDE.md) (раздел CORS/captcha).
- CSP для внешних проектов: [MARKBASE_PLUGINS_OUR_SIDE.md](../../MARKBASE_PLUGINS_OUR_SIDE.md).

### Настройка провайдеров

#### Собственная капча (custom)

Работает **из коробки**, не требует настройки. Генерирует SVG-изображения с искажённым текстом.

Уровни сложности:
| Сложность | Символов | Шум | Макс. попыток |
|-----------|:--------:|:---:|:---:|
| `easy` | 4 | Мало | 5 |
| `medium` | 5 | Средне | 3 |
| `hard` | 6 | Много | 2 |

#### Яндекс SmartCaptcha

1. Зайдите на [Яндекс.Облако](https://cloud.yandex.ru/services/smartcaptcha)
2. Создайте SmartCaptcha
3. Укажите разрешённые домены
4. Скопируйте `site_key` и `secret_key`
5. При создании проекта укажите:
```json
{
  "provider": "yandex",
  "yandex_site_key": "...",
  "yandex_secret_key": "..."
}
```

#### Google reCAPTCHA v3

1. Зайдите на [reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Создайте reCAPTCHA v3
3. Укажите домены
4. При создании проекта укажите:
```json
{
  "provider": "google",
  "google_site_key": "...",
  "google_secret_key": "...",
  "google_min_score": 0.5
}
```

---

## База данных

### Схема: `captcha`

| Таблица | Описание |
|---------|----------|
| `projects` | Проекты с ключами, настройками, разрешёнными доменами |
| `challenges` | Сгенерированные челленджи (собственная капча) |
| `verifications` | Лог всех проверок (успех/неудача/fail-open) |
| `daily_stats` | Агрегация по дням |
| `migrations` | Применённые миграции |

### Ключевые поля `projects`

| Поле | Тип | Описание |
|------|-----|----------|
| `site_key` | `VARCHAR(64)` | Публичный ключ (`mb_cap_live_...`) |
| `secret_key` | `VARCHAR(128)` | Секретный ключ (`mb_caps_live_...`) |
| `provider` | `VARCHAR(32)` | Основной провайдер |
| `fallback_provider` | `VARCHAR(32)` | Резервный провайдер |
| `allowed_domains` | `JSONB` | Разрешённые домены `["mysite.ru"]` |
| `fail_open` | `BOOLEAN` | Fail-open стратегия |
| `difficulty` | `VARCHAR(16)` | Сложность (easy/medium/hard) |

---

## Отказоустойчивость

```
Запрос на проверку капчи
    │
    ├── ✅ Основной провайдер доступен → Проверяем
    │       ├── ✅ Успех → Пропускаем
    │       └── ❌ Неудача → Блокируем
    │
    ├── ⚠️ Основной недоступен → Fallback-провайдер
    │       ├── ✅ Успех → Пропускаем
    │       └── ❌ Неудача → Блокируем
    │
    ├── ⚠️ Оба недоступны → Fail-Open
    │       └── ⚠️ Пропускаем + логируем
    │
    └── 🔴 Captcha Service полностью недоступен
            └── ⚠️ Middleware fail-open → Пропускаем + логируем
```

### Кэширование

- Конфигурация проектов кэшируется **1 минуту** (in-memory)
- При недоступности БД — используется кэш (даже устаревший)
- Челленджи живут **5 минут** (настраивается)

---

## Docker

### Запуск

```bash
cd modules/captcha/deploy
cp .env.example .env
# Отредактируйте .env
docker compose up -d
```

### Проверка

```bash
curl http://localhost:8079/health

# Ответ:
# {"status":"ok","service":"markbase-captcha","version":"1.0.0","postgres":true,...}
```

---

## Виджет MBCaptcha

### API виджета

```javascript
// Отрисовать капчу
const id = MBCaptcha.render('#container', {
  siteKey: 'mb_cap_live_...',
  provider: 'custom',   // custom | yandex | google
  theme: 'light',       // light | dark
  lang: 'ru',           // ru | en
  action: 'register',   // действие для статистики
  onVerify: (result) => {},  // { success, token, provider, challengeId }
  onError: (error) => {},    // { error, attempts_left }
  onExpire: () => {}         // токен истёк
});

// Получить токен
MBCaptcha.getToken(id);

// Сбросить (перезагрузить)
MBCaptcha.reset(id);

// Удалить
MBCaptcha.destroy(id);
```

### Поддержка тем

```javascript
// Светлая тема (по умолчанию)
MBCaptcha.render('#cap', { theme: 'light' });

// Тёмная тема
MBCaptcha.render('#cap', { theme: 'dark' });
```

---

## Changelog

### 1.1.0 (2026-02-09)
- **Порт изменён:** 8062 → 8079 (8062 конфликтовал с Server Mgmt)
- **Fix: Двойная верификация** — Frontend `Captcha.js` больше не вызывает `/verify` напрямую, верификация только на backend
- **Fix: Captcha URL** — Динамическое определение URL сервиса (`https://captcha.markbase.ru` для продакшена)
- **Fix: Fail-open tokens** — Backend middleware корректно обрабатывает `fail_open` токены от frontend
- **Интеграция в core** — Captcha полностью интегрирована в `docker-compose.yml`, `core-postgres`, `redeploy-interactive.sh`
- **Nginx конфигурация** — Обновлены proxy_pass для порта 8079
- **БД** — `captcha_db` автоматически создаётся в `core-postgres`

### 1.0.0 (2026-02-08)
- Первый релиз
- Собственная SVG-капча (text + math) — по умолчанию
- Яндекс SmartCaptcha — интеграция
- Google reCAPTCHA v3 — интеграция
- Система ключей (site_key / secret_key) для проектов
- Виджет `widget.js` для встраивания на любой сайт
- Fail-Open стратегия с логированием
- Fallback между провайдерами
- Домен-фильтрация ключей
- Интеграция с UAM (регистрация, вход, смена пароля)
- React-компонент `<Captcha>` для frontend UAM
- Express middleware `verifyCaptcha()` для backend
- Статистика проверок и API управления проектами
- Docker + Nginx конфигурация

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

