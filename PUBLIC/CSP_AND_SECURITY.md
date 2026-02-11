# CSP и заголовки безопасности для интеграций MarkBase

Единый справочник по **Content-Security-Policy** и **Permissions-Policy** для корректной работы:

- входа и регистрации (UAM, auth.markbase.ru);
- капчи (SmartCaptcha, плагин captcha.markbase.ru);
- Google Tag Manager и Яндекс.Метрики;
- встраивания виджетов в iframe.

Используется в конфигах: `nginx/conf.d/app.markbase.conf`, `nginx/conf.d/markbase.conf`.

---

## 1. Типичные ошибки в консоли и их причины

| Ошибка в консоли | Причина | Решение |
|------------------|--------|---------|
| `Framing 'https://www.googletagmanager.com/' violates... frame-src` | GTM загружает iframe `ns.html` | Добавить `https://www.googletagmanager.com` в **frame-src** |
| `api/auth/me: 401` | Пользователь не авторизован | Ожидаемо на странице входа; не ошибка интеграции |
| `auth.markbase.ru/api/uam/v1/login: 400` | Неверные данные (email/пароль/капча) или CORS/credentials | Проверить тело запроса и что запрос идёт с `credentials: 'include'`; проверить CORS на auth |
| `accelerometer is not allowed in this document` | SmartCaptcha использует датчики для бот-детекции | Добавить в **Permissions-Policy**: `accelerometer=(self https://smartcaptcha.yandexcloud.net)` и `gyroscope=(self ...)` |
| `connect-src` блокирует запрос к auth/captcha | В CSP не указан домен API | Добавить `https://auth.markbase.ru` и при необходимости `https://captcha.markbase.ru` в **connect-src** |
| Запросы к `captcha.markbase.ru` блокируются | Нет разрешения на скрипты и запросы к плагину капчи | Добавить `https://captcha.markbase.ru` в **script-src** и **connect-src** |

---

## 2. Рекомендуемый CSP для app.markbase.ru

Используется для SPA (логин, регистрация, капча, UAM API, метрика, GTM).

```
default-src 'self' https:;
script-src 'self' 'unsafe-inline' 'unsafe-eval'
  https://www.googletagmanager.com
  https://mc.yandex.ru https://mc.yandex.com
  https://smartcaptcha.yandexcloud.net
  https://auth.markbase.ru
  https://captcha.markbase.ru;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https:;
font-src 'self' data: https://yastatic.net https://fonts.gstatic.com;
connect-src 'self'
  https://markbase.ru https://api.markbase.ru
  https://auth.markbase.ru https://registry.markbase.ru
  https://captcha.markbase.ru
  https://mc.yandex.ru https://mc.yandex.com
  wss://mc.yandex.ru wss://mc.yandex.com
  https://smartcaptcha.yandexcloud.net;
frame-src 'self'
  https://www.googletagmanager.com
  https://smartcaptcha.yandexcloud.net
  https://auth.markbase.ru;
```

**Обязательно:**

- **connect-src**: `auth.markbase.ru` — для вызовов UAM (login, register, check-email, logout, me); `captcha.markbase.ru` — для виджета капчи (challenge/verify).
- **script-src**: `captcha.markbase.ru` — загрузка `widget.js`; `smartcaptcha.yandexcloud.net` — SmartCaptcha.
- **frame-src**: `https://www.googletagmanager.com` — iframe GTM; `https://smartcaptcha.yandexcloud.net` — iframe капчи; `auth.markbase.ru` — если логин открывается в iframe.

---

## 3. Permissions-Policy для SmartCaptcha

Яндекс SmartCaptcha может использовать **accelerometer** и **gyroscope** для проверки. Если не разрешить — в консоли будет предупреждение и возможны ограничения.

Рекомендуемая строка заголовка:

```
Permissions-Policy: geolocation=(), microphone=(), camera=(), accelerometer=(self https://smartcaptcha.yandexcloud.net), gyroscope=(self https://smartcaptcha.yandexcloud.net)
```

В Nginx (одна строка):

```nginx
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), accelerometer=(self https://smartcaptcha.yandexcloud.net), gyroscope=(self https://smartcaptcha.yandexcloud.net)" always;
```

---

## 4. Минимальный CSP для сторонних модулей

Если модуль (например, отдельный фронт на своём домене) вызывает только UAM и капчу:

```
default-src 'self';
connect-src 'self' https://auth.markbase.ru https://captcha.markbase.ru https://api.markbase.ru;
script-src 'self' https://captcha.markbase.ru https://smartcaptcha.yandexcloud.net;
frame-src https://captcha.markbase.ru https://smartcaptcha.yandexcloud.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
```

При использовании GTM добавить в **script-src** и **frame-src**: `https://www.googletagmanager.com`.

---

## 5. Где настраивать

| Место | Когда использовать |
|-------|-------------------|
| **Nginx** (рекомендуется) | app.markbase.ru, markbase.ru и другие vhost'ы платформы |
| **HTML meta** | Если CSP задаётся на стороне фронта без Nginx |
| **Backend (Helmet и т.п.)** | Если заголовки отдаёт приложение, а не прокси |

Текущие конфиги Nginx: `nginx/conf.d/app.markbase.conf`, `nginx/conf.d/markbase.conf` — должны соответствовать этому документу.

---

## 6. Про 400 на /api/uam/v1/login

Ответ **400** от `auth.markbase.ru/api/uam/v1/login` не связан с CSP. Возможные причины:

- неверный email или пароль;
- не пройдена или не передана капча (`captcha_token` / SmartCaptcha);
- неверный формат тела запроса;
- CORS: запрос с другого origin без разрешённого `Access-Control-Allow-Origin` и без `credentials: 'include'`.

Проверьте:

1. Тело POST: `email`, `password`, при необходимости `captcha_token` (и другие поля капчи по контракту UAM).
2. Заголовки: `Content-Type: application/json`, запрос с фронта к UAM — с `credentials: 'include'` (или аналог в axios: `withCredentials: true`).
3. CORS на auth.markbase.ru: в `auth.markbase.ru-proxy.conf` (или аналоге) origin вашего фронта должен быть в списке разрешённых.

---

## 7. Предупреждение SmartCaptcha «robustness level»

Сообщение вида *"It is recommended that a robustness level be specified"* идёт из скрипта SmartCaptcha. На работу капчи оно обычно не влияет. При необходимости можно уточнить в документации Яндекса параметры инициализации (например, уровень «жёсткости») и передать их при вызове виджета/скрипта.

---

*Документ актуален для интеграций UAM, Captcha Plugin и фронтов MarkBase. При изменении доменов или добавлении новых сервисов обновите этот файл и соответствующие nginx-конфиги.*
