# QSM — Entraînement au calcul mental

Petite application web (sans installation, sans connexion) pour s'entraîner au calcul mental.

## Lancer l'appli

Double-clique simplement sur **`index.html`** : elle s'ouvre dans ton navigateur.
Les scores sont enregistrés localement dans le navigateur (rien n'est envoyé en ligne).

## Fonctionnalités

- **Choix des tables** de multiplication (×), addition (+) et soustraction (−), de 1 à 12.
- **Choix du nombre de calculs** par partie (10, 20, 30 ou 50).
- **Partie enchaînée, sans appuyer sur Entrée** :
  - bonne réponse → on passe automatiquement au calcul suivant ;
  - 1ʳᵉ erreur → un second essai est accordé ;
  - 2ᵉ erreur → la bonne réponse s'affiche pendant 4 s, puis on continue.
- **Score basé sur la rapidité** : plus tu réponds vite (et du 1er coup), plus le score
  par calcul est élevé. Le score de la partie est la moyenne par calcul.
- **Graphique de progression** sur le menu pour te comparer à tes parties précédentes.

## Détail du fonctionnement de la saisie

La validation est automatique dès que le nombre de chiffres tapés atteint celui de la
réponse attendue : pas besoin d'Entrée. Pour une réponse à un seul chiffre, une frappe
erronée compte donc immédiatement comme un essai raté (rythme rapide, volontaire).

## Fichiers

- `index.html` — structure
- `styles.css` — design (thème clair/sombre automatique, animations)
- `app.js` — logique du jeu, score, stockage et graphique
- `.claude/` — petit serveur local optionnel pour la prévisualisation (facultatif)
