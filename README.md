# UTSF Tracker

Application web (React + TypeScript + Vite) pour suivre une préparation trail vers l'UTSF.

## Fonctionnalités

- **Dashboard** : vue d'ensemble de la semaine, progression vers la course, dernières séances.
- **Log** : saisie rapide des séances (durée, distance, D+, FC, RPE, notes).
- **Plan** : plan d'entraînement sur 25 semaines avec phases, semaines de récupération et volume cible.
- **Analytics** : indicateurs de charge (TRIMP, sRPE, TSS), CTL/ATL/TSB, monotonie et strain.
- **Settings** : profil athlète + export/import JSON des données.
- **Gestion des séances** : édition, duplication, suppression et filtres de recherche.
- **Ajustements plan** : surcharge manuelle d'une semaine (volume, notes, récupération).

## Stack technique

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Dexie (IndexedDB local navigateur)
- Recharts

## Prérequis

- Node.js 20+ recommandé
- npm

## Installation

```bash
npm ci
```

## Lancer en local

```bash
npm run dev
```

Puis ouvrir l'URL affichée par Vite (généralement `http://localhost:5173`).

## Build production

```bash
npm run build
```

Le build est généré dans `dist/`.

## Qualité

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:run
```

## Déploiement

Le dépôt contient un workflow GitHub Actions (`.github/workflows/deploy.yml`) qui :

1. se déclenche sur les pushes sur `main`,
2. exécute `npm ci` puis `npm run build`,
3. publie `dist/` sur GitHub Pages.

La base Vite est configurée pour GitHub Pages :

```ts
base: "/utsf-tracker/"
```

## Données

Les données sont stockées localement dans le navigateur via IndexedDB (`UTSFTracker`).
Pense à faire des exports réguliers depuis l'écran **Settings**.
