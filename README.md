# Простое голосование (Borda)

Сайт: **https://poll69.vercel.app/**

Админ: **https://poll69.vercel.app/#/admin?key=rank2026admin**

## Как устроена база

Один JSON-файл: `data/votes.json` в этом репозитории.

- `GET /api/votes` — прочитать голоса  
- `POST /api/vote` — записать голос  
- `POST /api/reset` — скинуть (админ)

## Один шаг, чтобы запись заработала

Сейчас чтение уже есть, **запись** нужна 1 переменная на Vercel:

1. Создай GitHub token: https://github.com/settings/tokens  
   Classic → scope **`repo`** → Generate
2. Vercel → проект **poll69** → **Settings → Environment Variables**  
   - Name: `POLL_GITHUB_TOKEN`  
   - Value: *токен*  
   - Production ✅
3. **Deployments** → ⋮ на последнем → **Redeploy**  
   (если деплой был Canceled — сделай Redeploy)

Проверка: открой https://poll69.vercel.app/api/votes  
Должен быть JSON `{"votes":[],...}`, не ошибка про token.
