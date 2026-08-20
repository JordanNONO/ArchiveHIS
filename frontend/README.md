# HIS Archives — Frontend

Application React de l'application HIS Archives (Hetep Iaout Services).

Voir le [README à la racine du dépôt](../README.md) pour l'installation complète, les commandes de développement et le déploiement.

## Commandes utiles propres au frontend

```bash
npm install                 # dépendances (utiliser --legacy-peer-deps en cas de conflit)
npm start                   # serveur de dev (HTTPS, https://localhost:3000)
npm run build                # build de production dans build/
```

Basé sur Create React App + [react-app-rewired](https://github.com/timarney/react-app-rewired) (voir `config-overrides.js` pour les surcharges webpack, notamment le proxy de dev vers le backend).
