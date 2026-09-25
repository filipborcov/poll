# Team Rank Poll

Опрос ранжирования 2 команд (~15 человек). Borda count.

## 🚀 Рабочие ссылки (без логина)

| Ссылка | Примечание |
|--------|------------|
| **https://raw.githack.com/filipborcov/poll/main/index.html** | основной |
| https://raw.githack.com/filipborcov/poll/main/poll.html | single-file |

Админ: откройте опрос → внизу «Результаты (админ)»  
или добавьте `#/admin?key=rank2026admin` к URL.

## Vercel

Проект `poll` на Vercel **закрыт SSO** (Deployment Protection).  
Пока не отключите защиту, внешние пользователи видят только логин Vercel:

1. https://vercel.com/sitepro-filip/poll → **Settings → Deployment Protection**
2. Выключите **Vercel Authentication**
3. Save → Production URL заработает

## Настройка

Имена команд / секрет: в `index.html` (блок `POLL_CONFIG`) или `js/config.js`.

## Локально

```bash
python3 -m http.server 8080
# → http://localhost:8080
```
