# HIS Archives

Application de gestion et d'archivage de documents pour Hetep Iaout Services (HIS) — backend Laravel + frontend React.

## Structure du dépôt

- `backend/` — API Laravel (auth JWT, documents, PAI, notifications, jetons API...)
- `frontend/` — application React (Create React App + react-app-rewired)

## Prérequis

- PHP 8.2+, Composer
- Node.js, npm
- MySQL
- Un fichier `backend/.env` configuré (copier `backend/.env.example`) — base de données, SMTP, clés VAPID (push), identifiants Reverb (WebSocket)

## Installation (première fois)

```bash
# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
php artisan storage:link
php artisan migrate --seed

# Frontend
cd ../frontend
npm install
```

## Lancer l'application en développement

Le backend a besoin de **4 process distincts** en parallèle (chacun dans son propre terminal, ou en tâche de fond) :

```bash
cd backend
php artisan serve                 # API HTTP (http://localhost:8000)
php artisan queue:work            # jobs en fond (exports zip, etc. — QUEUE_CONNECTION=database)
php artisan reverb:start          # serveur WebSocket temps réel (BROADCAST_CONNECTION=reverb)
php artisan schedule:work         # commandes planifiées (alertes PAI, relances de délai, sauvegardes...)
```

Et le frontend :

```bash
cd frontend
npm start                         # http://localhost:3000
```

Sans l'un des 4 process backend : pas d'API (`serve`), pas de temps réel/notifications push instantanées (`reverb:start`), pas d'exports en fond (`queue:work`), ou pas d'alertes/relances/sauvegardes automatiques (`schedule:work`).

## Déploiement en production

Mêmes 4 commandes backend, packagées comme services systemd (queue worker, Reverb, timer remplaçant `schedule:work`) derrière un reverse-proxy Nginx qui sert le frontend buildé (`npm run build`) et route `/api`, `/broadcasting`, `/storage` vers PHP-FPM.
