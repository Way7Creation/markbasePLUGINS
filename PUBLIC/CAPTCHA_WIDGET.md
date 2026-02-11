# Виджет капчи MarkBase (captcha.markbase.ru)

Капча подключается через поддомен **captcha.markbase.ru** и работает на **любом сайте** — аналогично Google reCAPTCHA или Яндекс SmartCaptcha. Все настройки (ключи, домены, сложность, провайдер) задаются в админ-панели капчи.

---

## Способы подключения

### 1. Виджет (`widget.js`) — для ЛЮБОГО сайта

```html
<div id="mb-captcha"></div>
<script src="https://captcha.markbase.ru/widget.js"></script>
<script>
  MBCaptcha.render('#mb-captcha', {
    siteKey: 'mb_cap_live_xxxx',
    onVerify: function(result) { console.log(result.token); }
  });
</script>
```

### 2. React-компонент `<Captcha />` — внутри UAM

В UAM (auth.markbase.ru) капча встроена как React-компонент (`modules/uam/frontend/src/components/Captcha.js`). Используется на:

| Страница | Действие | Компонент |
|----------|----------|-----------|
| Регистрация | Шаг 3 — ввод пароля | `<Captcha action="register" />` |
| Вход | Условная проверка (при подозрении на бота) | `verifyCaptcha('login', { conditional: true })` |
| Смена пароля | Условная проверка | `verifyCaptcha('password_change', { conditional: true })` |

### 3. REST API — для бэкенда

Серверная верификация: `POST https://captcha.markbase.ru/api/captcha/v1/verify`.

---

## Подключение (данные из личного кабинета)

В личном кабинете плагина (Настройки → Код виджета) указаны:

- **Site Key (публичный)** — в .env как `REACT_APP_CAPTCHA_SITE_KEY` и на backend как `CAPTCHA_SITE_KEY`.
- **Secret Key (секретный)** — только в .env на сервере: `CAPTCHA_SECRET_KEY` (не в репозитории).
- **Домены** — например `.markbase.ru`, `.waygpt.ru`, `localhost`; проверяются на стороне плагина.
- **Сложность** — задаётся в плагине (например `medium`).

Пример для текущего проекта (значения из ЛК):

```env
# Backend
CAPTCHA_URL=https://captcha.markbase.ru
CAPTCHA_SECRET_KEY=mb_caps_live_<ваш_secret_из_ЛК>
CAPTCHA_SITE_KEY=mb_cap_live_a23189188d0e101edf99579fce3718ec2f471500
CAPTCHA_ENABLED=true
CAPTCHA_FAIL_OPEN=true
CAPTCHA_PROVIDER=custom

# Frontend (сборка)
REACT_APP_CAPTCHA_URL=https://captcha.markbase.ru
REACT_APP_CAPTCHA_SITE_KEY=mb_cap_live_a23189188d0e101edf99579fce3718ec2f471500
REACT_APP_CAPTCHA_ENABLED=true
REACT_APP_CAPTCHA_PROVIDER=custom
```

Полный шаблон: **env.example** (раздел «MARKBASE CAPTCHA PLUGIN»).

---

## Как это работает

1. Пользователь нажимает кнопку (Войти, Отправить и т.д.).
2. Вызывается `executeCaptcha()` из `useCaptcha({ action: 'login' })`.
3. Загружается виджет с `https://captcha.markbase.ru/widget.js` (если ещё не загружен).
4. Для провайдера **custom**: показывается модальное окно с картинкой и полем ввода; ответ отправляется в плагин, возвращается токен.
5. Для **yandex** / **google**: виджет работает в невидимом режиме (если настроено в плагине).
6. Токен (`captcha_token`, при необходимости `challenge_id`, `captcha_answer`) передаётся в запрос (login/register/…).
7. Backend отправляет токен в `https://captcha.markbase.ru/api/captcha/v1/verify` и по ответу решает, пропустить запрос или вернуть ошибку.

Отдельная «страница для вывода виджета» не нужна — виджет встроен в существующие формы.

---

## Документация

- Плагин капчи: [plugins/captcha/README.md](./plugins/captcha/README.md)
- CSP и заголовки: [CSP_AND_SECURITY.md](./CSP_AND_SECURITY.md)
