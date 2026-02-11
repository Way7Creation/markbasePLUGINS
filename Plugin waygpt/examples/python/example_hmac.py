"""
Пример использования WayGPT Client с HMAC подписью (Python)

HMAC рекомендуется для production окружений для дополнительной безопасности.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/python'))

from waygpt_client import WayGPTClient, WayGPTError


def main():
    # Инициализация клиента с HMAC
    client = WayGPTClient(
        api_url="https://app.waygpt.ru",
        project_key="sk_live_...",  # Замените на ваш ключ
        project_id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  # Замените на ваш Project ID
        hmac_secret="your-hmac-secret",  # Замените на ваш HMAC Secret
        use_hmac=True  # Включить HMAC
    )

    print("=== Пример с HMAC подписью ===\n")

    try:
        response = client.chat_completions(
            model="auto",
            messages=[
                {"role": "user", "content": "Привет! Это запрос с HMAC подписью."}
            ]
        )

        print("Ответ:", response["choices"][0]["message"]["content"])
        print("\n✅ Запрос успешно выполнен с HMAC подписью!")
    except WayGPTError as e:
        print(f"❌ Ошибка: {e.message} (код: {e.status_code})")
        if e.status_code == 401:
            print("\nПроверьте:")
            print("1. Правильность project_id (UUID)")
            print("2. Правильность hmac_secret")
            print("3. Что HMAC включен в настройках проекта в кабинете")


if __name__ == "__main__":
    main()
