# Forge — labo virtuel de génie civil / RDM

Atlas d'un ouvrage complet en 3D + ateliers manipulables (poutre, treillis, section BA, poteau, semelle, écoulement, pont, oscillateur).

## Tester en ligne

Application statique, sans backend. Un seul dossier :

- `index.html` — l'application
- `forge3d.js` — composants 3D
- `.nojekyll` — désactive Jekyll sur GitHub Pages

Three.js se charge depuis le CDN jsdelivr : connexion internet requise.

## Déployer sur GitHub Pages

```bash
# 1. Crée un dépôt vide sur github.com (ex: forge), PUBLIC
# 2. Dans ce dossier :
git init
git add .
git commit -m "Forge — labo RDM"
git branch -M main
git remote add origin https://github.com/<TON_USER>/forge.git
git push -u origin main
```

Puis sur GitHub : **Settings → Pages → Source: Deploy from a branch → Branch: main / root → Save**.

URL en ligne après ~1 min :
`https://<TON_USER>.github.io/forge/`

C'est ce lien que tu envoies aux étudiants.

## Mettre à jour

```bash
git add .
git commit -m "maj"
git push
```

Pages se régénère seul.
