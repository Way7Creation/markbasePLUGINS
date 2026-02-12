# Команды — Plugins (markbasePLUGINS)

## Вход на сервер (SSH ключи, пароль отключён)
```powershell
ssh server-root-main             # root (администратор)
ssh server-waysen-main           # markbase.ru
ssh server-waycore-main          # markbaseCORE
ssh server-waypay-main           # sererandpay
ssh server-w7c-main              # w7c
```
Полное руководство: `УПРАВЛЕНИЕ/SSH_ВХОД_И_КЛЮЧИ.md`

---

Плагины разворачиваются в составе основных проектов. Отдельного серверного деплоя у репозитория Plugins нет. В каждом из перечисленных проектов есть **один и тот же скрипт** `scripts/deployment/redeploy-interactive.sh` с одинаковыми флагами.

============================================
# ИНТЕРАКТИВНАЯ ПЕРЕСБОРКА (в проекте, куда подключены плагины)
============================================
Выполнять из **корня того проекта**, где развёрнут стек (markbaseCORE, markbase.ru, aiserver, sererandpay). Команды везде одинаковые, меняется только путь.
Скрипт АВТОМАТИЧЕСКИ: подтягивает код из git (fetch + reset --hard),
собирает образы (с кэшем + pull свежих base-образов), запускает контейнеры.
Локальные изменения на сервере перезаписываются — репозиторий = источник правды.

# Обычное обновление (99% случаев) — код из git, пересборка, миграции
cd /var/www/<ПРОЕКТ>   # markbase.ru | markbasecore | waygpt.ru/aiserver | waysen
sudo bash scripts/deployment/redeploy-interactive.sh

# Синхронизировать .env из примера (принудительно перезаписать)
sudo bash scripts/deployment/redeploy-interactive.sh --sync-env

# Очистка БД (требуется пароль root)
sudo bash scripts/deployment/redeploy-interactive.sh --wipe

# Очистка без подтверждения (всё равно запрашивается root)
sudo bash scripts/deployment/redeploy-interactive.sh --wipe --yes-all

# Без кеша Docker (МЕДЛЕННО! только если кэш Docker сломался — редчайший случай)
sudo bash scripts/deployment/redeploy-interactive.sh --no-cache

Подробные блоки по проектам: `markbaseCORE/commands.txt`, `markbase.ru/comand.txt`, `aiserver/command.md`, `sererandpay/command.md`.

---

## Локально / разработка

- Синхронизация с репозиторием: из корня `markbaseECOsystem` — `.\git-pull.ps1 Plugins` / `.\git-push.ps1 Plugins`
- Описание плагинов: `PUBLIC/plugins/README.md`, отдельные `plugin.json` в каждой папке плагина
