# Команды — Plugins (markbasePLUGINS)

Плагины разворачиваются в составе основных проектов. Отдельного серверного деплоя у репозитория Plugins нет. В каждом из перечисленных проектов есть **один и тот же скрипт** `scripts/deployment/redeploy-interactive.sh` с одинаковыми флагами.

============================================
# ИНТЕРАКТИВНАЯ ПЕРЕСБОРКА (в проекте, куда подключены плагины)
============================================
Выполнять из **корня того проекта**, где развёрнут стек (markbaseCORE, moduletrade.ru, aiserver, sererandpay). Команды везде одинаковые, меняется только путь:

# Полная пересборка БЕЗ удаления БД
cd /var/www/<ПРОЕКТ>   # markbase.ru | markbasecore | waygpt.ru/aiserver | waysen
sudo bash scripts/deployment/redeploy-interactive.sh

# Синхронизировать .env из примера
sudo bash scripts/deployment/redeploy-interactive.sh --sync-env

# Полная очистка БД (требуется пароль root)
sudo bash scripts/deployment/redeploy-interactive.sh --wipe

# Очистка БД без дополнительного подтверждения (всё равно запрашивается root)
sudo bash scripts/deployment/redeploy-interactive.sh --wipe --yes-all

# Пересборка без кеша
sudo bash scripts/deployment/redeploy-interactive.sh --no-cache

Подробные блоки по проектам: `markbaseCORE/commands.txt`, `moduletrade.ru/comand.txt`, `aiserver/command.md`, `sererandpay/command.md`.

---

## Локально / разработка

- Синхронизация с репозиторием: из корня `markbaseECOsystem` — `.\git-pull.ps1 Plugins` / `.\git-push.ps1 Plugins`
- Описание плагинов: `PUBLIC/plugins/README.md`, отдельные `plugin.json` в каждой папке плагина
