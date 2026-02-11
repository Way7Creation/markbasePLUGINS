# Инструкция по установке WayGPT Plugin

Этот документ содержит пошаговые инструкции по установке и настройке плагина WayGPT для разных языков программирования.

---

## 📋 Общие требования

### 1. Получение ключей доступа

Перед установкой плагина вам необходимо получить ключи доступа:

1. Войдите в кабинет AI Server: `https://app.waygpt.ru` (или ваш домен)
2. Перейдите в **Кабинет → API‑ключи → Ключи проектов**
3. Создайте новый проект или выберите существующий
4. Скопируйте следующие данные:
   - **Project Key** (`sk_live_...`) - обязателен
   - **Project ID** (UUID) - нужен для HMAC
   - **HMAC Secret** - нужен для HMAC (если планируете использовать)

---

## 🐍 Python

### Шаг 1: Установка зависимостей

```bash
# Установите Python 3.7+ если еще не установлен
python --version

# Установите зависимости
pip install -r requirements.txt

# Или установите напрямую
pip install requests
```

### Шаг 2: Копирование файла SDK

```bash
# Скопируйте файл SDK в ваш проект
cp "Plugin waygpt/src/python/waygpt_client.py" /path/to/your/project/
```

### Шаг 3: Настройка

**Вариант 1: Через переменные окружения (рекомендуется)**

Создайте файл `.env` или установите переменные окружения:

```bash
export WAYGPT_API_URL="https://app.waygpt.ru"
export WAYGPT_PROJECT_KEY="sk_live_..."
export WAYGPT_PROJECT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # для HMAC
export WAYGPT_HMAC_SECRET="your-hmac-secret"  # для HMAC
export WAYGPT_USE_HMAC="false"
```

**Вариант 2: Прямо в коде**

```python
from waygpt_client import WayGPTClient

client = WayGPTClient(
    api_url="https://app.waygpt.ru",
    project_key="sk_live_...",
    use_hmac=False
)
```

### Шаг 4: Тестирование

```bash
# Запустите пример
python examples/python/example_basic.py
```

---

## 📦 JavaScript/Node.js

### Шаг 1: Установка зависимостей

```bash
# Убедитесь, что Node.js 14+ установлен
node --version

# Установите зависимости
npm install

# Или установите напрямую
npm install axios
```

### Шаг 2: Копирование файла SDK

```bash
# Скопируйте файл SDK в ваш проект
cp "Plugin waygpt/src/javascript/waygpt-client.js" /path/to/your/project/
```

### Шаг 3: Настройка

**Вариант 1: Через переменные окружения (рекомендуется)**

Создайте файл `.env` или установите переменные окружения:

```bash
export WAYGPT_API_URL="https://app.waygpt.ru"
export WAYGPT_PROJECT_KEY="sk_live_..."
export WAYGPT_PROJECT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export WAYGPT_HMAC_SECRET="your-hmac-secret"
export WAYGPT_USE_HMAC="false"
```

**Вариант 2: Прямо в коде**

```javascript
const { WayGPTClient } = require('./waygpt-client');

const client = new WayGPTClient({
    apiUrl: 'https://app.waygpt.ru',
    projectKey: 'sk_live_...',
    useHmac: false
});
```

### Шаг 4: Тестирование

```bash
# Запустите пример
node examples/javascript/example-basic.js
```

---

## 🐘 PHP

### Шаг 1: Проверка требований

```bash
# Убедитесь, что PHP 7.4+ установлен
php --version

# Проверьте наличие необходимых расширений
php -m | grep curl
php -m | grep json
php -m | grep openssl
```

Если расширения отсутствуют, установите их:

**Ubuntu/Debian:**
```bash
sudo apt-get install php-curl php-json php-openssl
```

**CentOS/RHEL:**
```bash
sudo yum install php-curl php-json php-openssl
```

### Шаг 2: Копирование файла SDK

```bash
# Скопируйте файл SDK в ваш проект
cp "Plugin waygpt/src/php/WayGPTClient.php" /path/to/your/project/
```

### Шаг 3: Настройка

**Вариант 1: Через переменные окружения (рекомендуется)**

Установите переменные окружения в вашем веб-сервере или через `.htaccess`:

```apache
SetEnv WAYGPT_API_URL "https://app.waygpt.ru"
SetEnv WAYGPT_PROJECT_KEY "sk_live_..."
SetEnv WAYGPT_PROJECT_ID "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
SetEnv WAYGPT_HMAC_SECRET "your-hmac-secret"
SetEnv WAYGPT_USE_HMAC "false"
```

Или в PHP коде:

```php
$_ENV['WAYGPT_API_URL'] = 'https://app.waygpt.ru';
$_ENV['WAYGPT_PROJECT_KEY'] = 'sk_live_...';
```

**Вариант 2: Прямо в коде**

```php
require_once 'WayGPTClient.php';

$client = new WayGPTClient([
    'api_url' => 'https://app.waygpt.ru',
    'project_key' => 'sk_live_...',
    'use_hmac' => false
]);
```

### Шаг 4: Тестирование

```bash
# Запустите пример
php examples/php/example_basic.php
```

---

## 🔐 Настройка HMAC (для production)

HMAC подпись рекомендуется для production окружений для дополнительной безопасности.

### Шаг 1: Включение HMAC в кабинете

1. Перейдите в **Кабинет → API‑ключи → [Ваш проект] → Настройки**
2. Включите **"Требовать HMAC подпись"**
3. Установите **HMAC Secret** (сохраните его в безопасном месте!)

### Шаг 2: Настройка в коде

**Python:**
```python
client = WayGPTClient(
    api_url="https://app.waygpt.ru",
    project_key="sk_live_...",
    project_id="your-project-id",  # UUID из кабинета
    hmac_secret="your-hmac-secret",  # Из настроек проекта
    use_hmac=True
)
```

**JavaScript:**
```javascript
const client = new WayGPTClient({
    apiUrl: 'https://app.waygpt.ru',
    projectKey: 'sk_live_...',
    projectId: 'your-project-id',
    hmacSecret: 'your-hmac-secret',
    useHmac: true
});
```

**PHP:**
```php
$client = new WayGPTClient([
    'api_url' => 'https://app.waygpt.ru',
    'project_key' => 'sk_live_...',
    'project_id' => 'your-project-id',
    'hmac_secret' => 'your-hmac-secret',
    'use_hmac' => true
]);
```

### Шаг 3: Тестирование HMAC

**Python:**
```bash
python examples/python/example_hmac.py
```

---

## ✅ Проверка установки

После установки выполните простой тест:

**Python:**
```python
from waygpt_client import WayGPTClient

client = WayGPTClient(project_key="sk_live_...")
models = client.get_models()
print(f"✅ Установка успешна! Доступно моделей: {len(models)}")
```

**JavaScript:**
```javascript
const { WayGPTClient } = require('./waygpt-client');

const client = new WayGPTClient({ projectKey: 'sk_live_...' });
client.getModels().then(models => {
    console.log(`✅ Установка успешна! Доступно моделей: ${models.length}`);
});
```

**PHP:**
```php
require_once 'WayGPTClient.php';

$client = new WayGPTClient(['project_key' => 'sk_live_...']);
$models = $client->getModels();
echo "✅ Установка успешна! Доступно моделей: " . count($models) . "\n";
```

---

## 🆘 Решение проблем

### Ошибка: "project_key обязателен"

**Решение:** Убедитесь, что вы указали `project_key` при инициализации клиента или через переменную окружения.

### Ошибка: "401 Unauthorized"

**Решение:**
1. Проверьте правильность `project_key`
2. Убедитесь, что проект активен в кабинете
3. Проверьте, что домен разрешен (если настроен `allowed_domains`)

### Ошибка: "403 Forbidden" с HMAC

**Решение:**
1. Проверьте правильность `project_id` (должен быть UUID)
2. Убедитесь, что `hmac_secret` совпадает с настройками в кабинете
3. Проверьте системное время (должно быть синхронизировано)

### Ошибка: "Module not found" (Python/JavaScript)

**Решение:** Убедитесь, что вы установили все зависимости:
- Python: `pip install requests`
- JavaScript: `npm install axios`

### Ошибка: "Call to undefined function curl_init" (PHP)

**Решение:** Установите расширение curl:
```bash
sudo apt-get install php-curl  # Ubuntu/Debian
sudo yum install php-curl       # CentOS/RHEL
```

---

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте документацию в `README.md`
2. Посмотрите примеры в папке `examples/`
3. Проверьте логи ошибок
4. Обратитесь в поддержку AI Server

---

**Версия:** 1.0.0  
**Последнее обновление:** 2024
