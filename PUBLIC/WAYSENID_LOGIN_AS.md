# «Войти через WaySenID» — подключение как модуль (аналог «Войти через Google / Яндекс»)

Документ описывает, как добавить кнопку **«Войти через WaySenID»** в проект с **собственной системой регистрации** — так же, как подключают «Войти через Google» или «Войти через Яндекс ID». Один раз настроили — данные пользователя передаются корректно, без дублирования логики входа и регистрации на вашей стороне.

---

## 1. Роль кнопки

- На странице входа/регистрации у вас могут быть: своя форма (email + пароль), «Войти через Google», «Войти через Яндекс».
- **«Войти через WaySenID»** — ещё один способ входа: пользователь переходит на auth.markbase.ru, входит или регистрируется там (включая капчу и подтверждение email), после чего возвращается к вам с **идентификатором и данными пользователя**.
- Вам **не нужно** реализовывать формы регистрации/логина для WaySenID, хранить пароли или показывать капчу — всё это делает auth.markbase.ru.

---

## 2. Два варианта интеграции

Выбор зависит от того, где размещён ваш проект.

| Вариант | Домен вашего проекта | Механизм возврата данных |
|--------|-----------------------|---------------------------|
| **A. Тот же домен** | `*.markbase.ru` или `markbase.ru` | После входа на auth пользователь перенаправляется обратно на ваш `return_url`. Cookie `uam_session` устанавливается на `.markbase.ru` и доступна вашему фронту и бэкенду. Проверка сессии — через `GET https://auth.markbase.ru/api/uam/v1/session/validate` с этой cookie. |
| **B. Сторонний домен** | Любой другой (например `waygpt.ru`, `myshop.com`) | Cookie с auth.markbase.ru на ваш домен не передаётся. После входа auth перенаправляет пользователя на ваш `return_url` с **одноразовым кодом** в query: `?wsid_code=...`. Ваш бэкенд обменивает этот код на данные пользователя через `POST https://auth.markbase.ru/api/uam/v1/exchange-code` и создаёт у себя сессию/пользователя. |

---

## 3. Общая схема (для любого варианта)

```
Пользователь на вашем сайте
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Ваша страница входа                                         │
│  [ Войти через Google ]  [ Войти через Яндекс ]              │
│  [ Войти через WaySenID ]   ← одна кнопка                    │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼  Редирект
        https://auth.markbase.ru/login?return_url=<ваш callback URL>
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  auth.markbase.ru                                            │
│  Выбор аккаунта / Ввод email и пароля / Регистрация          │
│  Капча, подтверждение email — всё на стороне WaySenID         │
└──────────────────────────────┬──────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │ Вариант A (*.markbase.ru)                     │ Вариант B (другой домен)
        ▼                                               ▼
  Редирект на return_url                         Редирект на return_url
  + Cookie: uam_session                         + ?wsid_code=одноразовый_код
  Ваш бэкенд проверяет сессию                    Ваш callback: POST /exchange-code
  через GET /session/validate                    с code → получает user, создаёт сессию
```

Данные пользователя в обоих случаях одни и те же (см. ниже).

---

## 4. Какие данные вы получаете

После успешного входа/обмена кода вы получаете **одного и того же пользователя** в едином формате.

### Вариант A (cookie + session/validate)

Запрос:

```http
GET https://auth.markbase.ru/api/uam/v1/session/validate
Cookie: uam_session=<токен>
```

Ответ (200):

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "display_name": "Иван Петров",
  "role": "user",
  "email_verified_at": "2026-01-15T12:00:00.000Z",
  "metadata": {},
  "consents_accepted": true
}
```

### Вариант B (wsid_code + exchange-code)

Редирект на вас:  
`https://yoursite.com/auth/callback?wsid_code=одноразовый_код`  
(код живёт **60 секунд**, одноразовый).

Ваш бэкенд:

```http
POST https://auth.markbase.ru/api/uam/v1/exchange-code
Content-Type: application/json

{ "code": "значение из wsid_code" }
```

Ответ (200):

```json
{
  "success": true,
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "display_name": "Иван Петров",
    "role": "user",
    "email_verified_at": "2026-01-15T12:00:00.000Z",
    "metadata": {}
  }
}
```

Дальше вы создаёте у себя пользователя/сессию по `user_id` и `email` (и при необходимости привязываете к своей БД). Передача данных — только через официальные эндпоинты UAM, без дублирования логики паролей и регистрации.

---

## 5. Настройка return_url (обязательно)

- Домен из `return_url` должен быть разрешён в конфигурации UAM (список `UAM_RETURN_URL_ALLOWLIST`, по умолчанию `.markbase.ru`, `.waygpt.ru`). Для **стороннего домена** его нужно добавить в allowlist (настройки auth.markbase.ru / markbaseCORE).
- Для варианта B callback должен быть по HTTPS и обрабатывать `GET ...?wsid_code=...` без раскрытия кода в логах; обмен кода на пользователя — только на бэкенде.

---

## 6. Кнопка на фронте

Единообразно для всех проектов:

- Текст: **«Войти через WaySenID»** (или «Продолжить с WaySenID»).
- Действие: редирект на  
  `https://auth.markbase.ru/login?return_url=<encoded ваш callback URL>`  
  Для регистрации:  
  `https://auth.markbase.ru/register?return_url=<encoded ваш callback URL>`  
- Стили и размеры — см. [auth-widget/README.md](./auth-widget/README.md) и [auth-widget/waysenid.css](./auth-widget/waysenid.css).

Пример:

```html
<a href="https://auth.markbase.ru/login?return_url=https%3A%2F%2Fyoursite.com%2Fauth%2Fcallback"
   class="wsid-btn wsid-btn--primary wsid-btn--md">
  Войти через WaySenID
</a>
```

Для popup-режима и SDK — [auth-widget/README.md](./auth-widget/README.md) и [auth-widget/INTEGRATION.md](./auth-widget/INTEGRATION.md).

---

## 7. Краткий чеклист для вашего проекта

| Шаг | Действие |
|-----|----------|
| 1 | Добавить на страницу входа одну кнопку «Войти через WaySenID» (редирект на auth.markbase.ru с `return_url`). |
| 2 | Реализовать callback: для A — проверка cookie через `session/validate`; для B — чтение `wsid_code`, вызов `POST /exchange-code`, создание своей сессии/пользователя. |
| 3 | Добавить домен callback в allowlist UAM (если не `*.markbase.ru`). |
| 4 | Не дублировать: формы логина/регистрации WaySenID, капчу и хранение паролей WaySenID у себя. |
| 5 | Использовать полученные поля `user_id`, `email`, `display_name` и при необходимости `metadata` как единственный источник правды о пользователе WaySenID. |

---

## 8. Дополнительные материалы

| Документ | Содержание |
|----------|------------|
| [auth-widget/README.md](./auth-widget/README.md) | Кнопка, OAuth/SDK, дизайн, ошибки. |
| [auth-widget/INTEGRATION.md](./auth-widget/INTEGRATION.md) | Полный сценарий интеграции, backend, БД, безопасность. |
| [plugins/uam/README.md](./plugins/uam/README.md) | API UAM: login, register, session/validate, exchange-code, защита, переключение аккаунтов. |
| [MARKBASE_MODULES_AUTH.md](./MARKBASE_MODULES_AUTH.md) | Как устроен единый вход в модулях markbase.ru (без своих форм). |

При такой схеме кнопка «Войти через WaySenID» подключается как отдельный модуль (как «Войти через Google»), все данные передаются через официальные эндпоинты UAM, без дублей логики и без лишней нагрузки на вашу систему.
