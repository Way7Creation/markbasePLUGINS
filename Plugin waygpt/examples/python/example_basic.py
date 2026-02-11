"""
Базовый пример использования WayGPT Client (Python)

Перед запуском:
1. Установите зависимости: pip install requests
2. Укажите ваш project_key в коде или через переменную окружения WAYGPT_PROJECT_KEY
"""

import sys
import os

# Добавляем путь к SDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/python'))

from waygpt_client import WayGPTClient, WayGPTError


def main():
    # Инициализация клиента
    client = WayGPTClient(
        api_url="https://app.waygpt.ru",  # или ваш домен
        project_key="sk_live_...",  # Замените на ваш ключ
        use_hmac=False
    )

    print("=== Пример 1: Простой чат ===\n")

    try:
        response = client.chat_completions(
            model="auto",
            messages=[
                {"role": "user", "content": "Привет! Расскажи о себе кратко."}
            ]
        )

        print("Ответ:", response["choices"][0]["message"]["content"])
        print(f"\nИспользовано токенов: {response['usage']['total_tokens']}")
    except WayGPTError as e:
        print(f"Ошибка: {e.message} (код: {e.status_code})")

    print("\n=== Пример 2: Стриминг ответов ===\n")

    try:
        print("Ответ (стриминг): ", end="", flush=True)
        for chunk in client.chat_completions_stream(
            model="auto",
            messages=[
                {"role": "user", "content": "Расскажи короткую историю про кота"}
            ]
        ):
            if chunk.get("choices"):
                delta = chunk["choices"][0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    print(content, end="", flush=True)
        print("\n")
    except WayGPTError as e:
        print(f"\nОшибка: {e.message} (код: {e.status_code})")

    print("\n=== Пример 3: Получение списка моделей ===\n")

    try:
        models = client.get_models()
        print(f"Доступно моделей: {len(models)}")
        print("Первые 5 моделей:", models[:5])
    except WayGPTError as e:
        print(f"Ошибка: {e.message} (код: {e.status_code})")

    print("\n=== Пример 4: Генерация изображения ===\n")

    try:
        response = client.image_generations(
            prompt="Красивый закат над морем, цифровое искусство",
            model="yandex-art",
            size="1024x1024"
        )
        print("Изображение сгенерировано!")
        print("URL:", response["data"][0]["url"])
    except WayGPTError as e:
        print(f"Ошибка: {e.message} (код: {e.status_code})")


if __name__ == "__main__":
    main()
