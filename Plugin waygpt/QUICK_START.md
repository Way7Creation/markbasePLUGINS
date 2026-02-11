# Быстрый старт - WayGPT Plugin

Минимальная инструкция для начала работы за 5 минут.

---

## 🚀 Шаг 1: Получите ключ доступа

1. Войдите в кабинет: `https://app.waygpt.ru`
2. Перейдите: **Кабинет → API‑ключи → Ключи проектов**
3. Скопируйте **Project Key** (`sk_live_...`)

---

## 🐍 Python (2 минуты)

```bash
# 1. Установите зависимости
pip install requests

# 2. Скопируйте SDK
cp "Plugin waygpt/src/python/waygpt_client.py" ./

# 3. Создайте файл test.py
```

```python
from waygpt_client import WayGPTClient

client = WayGPTClient(
    project_key="sk_live_..."  # Ваш ключ
)

response = client.chat_completions(
    model="auto",
    messages=[{"role": "user", "content": "Привет!"}]
)

print(response["choices"][0]["message"]["content"])
```

```bash
# 4. Запустите
python test.py
```

---

## 📦 JavaScript/Node.js (2 минуты)

```bash
# 1. Установите зависимости
npm install axios

# 2. Скопируйте SDK
cp "Plugin waygpt/src/javascript/waygpt-client.js" ./

# 3. Создайте файл test.js
```

```javascript
const { WayGPTClient } = require('./waygpt-client');

const client = new WayGPTClient({
    projectKey: 'sk_live_...'  // Ваш ключ
});

client.chatCompletions({
    model: 'auto',
    messages: [{ role: 'user', content: 'Привет!' }]
}).then(response => {
    console.log(response.choices[0].message.content);
});
```

```bash
# 4. Запустите
node test.js
```

---

## 🐘 PHP (2 минуты)

```bash
# 1. Убедитесь, что установлен curl
php -m | grep curl

# 2. Скопируйте SDK
cp "Plugin waygpt/src/php/WayGPTClient.php" ./

# 3. Создайте файл test.php
```

```php
<?php
require_once 'WayGPTClient.php';

$client = new WayGPTClient([
    'project_key' => 'sk_live_...'  // Ваш ключ
]);

$response = $client->chatCompletions([
    'model' => 'auto',
    'messages' => [
        ['role' => 'user', 'content' => 'Привет!']
    ]
]);

echo $response['choices'][0]['message']['content'];
```

```bash
# 4. Запустите
php test.php
```

---

## ✅ Готово!

Если вы видите ответ от AI, значит всё работает! 

Теперь вы можете:
- Изучить примеры в папке `examples/`
- Прочитать полную документацию в `README.md`
- Настроить HMAC для production (см. `INSTALLATION.md`)

---

## 🆘 Проблемы?

**Ошибка 401:** Проверьте правильность `project_key`

**Ошибка "Module not found":** Установите зависимости:
- Python: `pip install requests`
- JavaScript: `npm install axios`

**Другие проблемы:** См. `INSTALLATION.md` → "Решение проблем"
