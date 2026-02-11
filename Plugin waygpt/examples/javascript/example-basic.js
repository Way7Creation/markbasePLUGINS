/**
 * Базовый пример использования WayGPT Client (JavaScript/Node.js)
 * 
 * Перед запуском:
 * 1. Установите зависимости: npm install axios
 * 2. Укажите ваш project_key в коде или через переменную окружения WAYGPT_PROJECT_KEY
 */

const { WayGPTClient, WayGPTError } = require('../../src/javascript/waygpt-client');

async function main() {
    // Инициализация клиента
    const client = new WayGPTClient({
        apiUrl: 'https://app.waygpt.ru',  // или ваш домен
        projectKey: 'sk_live_...',  // Замените на ваш ключ
        useHmac: false
    });

    console.log('=== Пример 1: Простой чат ===\n');

    try {
        const response = await client.chatCompletions({
            model: 'auto',
            messages: [
                { role: 'user', content: 'Привет! Расскажи о себе кратко.' }
            ]
        });

        console.log('Ответ:', response.choices[0].message.content);
        console.log(`\nИспользовано токенов: ${response.usage.total_tokens}`);
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error('Ошибка:', error.message);
        }
    }

    console.log('\n=== Пример 2: Стриминг ответов ===\n');

    try {
        process.stdout.write('Ответ (стриминг): ');
        for await (const chunk of client.chatCompletionsStream({
            model: 'auto',
            messages: [
                { role: 'user', content: 'Расскажи короткую историю про кота' }
            ]
        })) {
            if (chunk.choices && chunk.choices[0].delta) {
                const content = chunk.choices[0].delta.content;
                if (content) {
                    process.stdout.write(content);
                }
            }
        }
        console.log('\n');
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`\nОшибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error('\nОшибка:', error.message);
        }
    }

    console.log('\n=== Пример 3: Получение списка сценариев (use-cases) ===\n');

    try {
        const useCases = await client.getUseCases();
        console.log(`Сценариев: ${useCases.length}`);
        if (useCases.length > 0) {
            console.log('Пример (key):', useCases[0].key);
        }
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error('Ошибка:', error.message);
        }
    }

    console.log('\n=== Пример 4: Получение списка моделей ===\n');

    try {
        const models = await client.getModels();
        console.log(`Доступно моделей: ${models.length}`);
        console.log('Первые 5 моделей:', models.slice(0, 5));
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error('Ошибка:', error.message);
        }
    }

    console.log('\n=== Пример 5: Генерация изображения ===\n');

    try {
        const response = await client.imageGenerations({
            prompt: 'Красивый закат над морем, цифровое искусство',
            model: 'yandex-art',
            size: '1024x1024'
        });
        console.log('Изображение сгенерировано!');
        console.log('URL:', response.data[0].url);
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error('Ошибка:', error.message);
        }
    }
}

main().catch(console.error);
