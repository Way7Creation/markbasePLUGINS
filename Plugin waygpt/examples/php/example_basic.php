<?php
/**
 * Базовый пример использования WayGPT Client (PHP)
 * 
 * Перед запуском:
 * 1. Убедитесь, что установлены расширения: curl, json, openssl
 * 2. Укажите ваш project_key в коде или через переменную окружения WAYGPT_PROJECT_KEY
 */

require_once __DIR__ . '/../../src/php/WayGPTClient.php';

try {
    // Инициализация клиента
    $client = new WayGPTClient([
        'api_url' => 'https://app.waygpt.ru',  // или ваш домен
        'project_key' => 'sk_live_...',  // Замените на ваш ключ
        'use_hmac' => false
    ]);

    echo "=== Пример 1: Простой чат ===\n\n";

    try {
        $response = $client->chatCompletions([
            'model' => 'auto',
            'messages' => [
                ['role' => 'user', 'content' => 'Привет! Расскажи о себе кратко.']
            ]
        ]);

        echo "Ответ: " . $response['choices'][0]['message']['content'] . "\n";
        echo "\nИспользовано токенов: " . $response['usage']['total_tokens'] . "\n";
    } catch (WayGPTException $e) {
        echo "Ошибка: {$e->getMessage()} (код: {$e->statusCode})\n";
    }

    echo "\n=== Пример 2: Получение списка моделей ===\n\n";

    try {
        $models = $client->getModels();
        echo "Доступно моделей: " . count($models) . "\n";
        echo "Первые 5 моделей: " . implode(', ', array_slice($models, 0, 5)) . "\n";
    } catch (WayGPTException $e) {
        echo "Ошибка: {$e->getMessage()} (код: {$e->statusCode})\n";
    }

    echo "\n=== Пример 3: Генерация изображения ===\n\n";

    try {
        $response = $client->imageGenerations([
            'prompt' => 'Красивый закат над морем, цифровое искусство',
            'model' => 'yandex-art',
            'size' => '1024x1024'
        ]);
        echo "Изображение сгенерировано!\n";
        echo "URL: " . $response['data'][0]['url'] . "\n";
    } catch (WayGPTException $e) {
        echo "Ошибка: {$e->getMessage()} (код: {$e->statusCode})\n";
    }

} catch (Exception $e) {
    echo "Критическая ошибка: {$e->getMessage()}\n";
    exit(1);
}
