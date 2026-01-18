# Documentation – Mathis Cool

Cette application est un jeu de calcul mental (addition) conçu pour être **simple**, **motivant** et **sans stress**.

- Données stockées localement (pas de backend)
- Fonctionne hors ligne (service worker)
- Navigation minimaliste : Accueil → Jouer / Mes progrès

---

## 1) Écrans de l’application

### Accueil

L’écran d’accueil propose :

- `Jouer` : démarre une session de questions
- `Mes progrès` : affiche les statistiques, un graphique, et les récompenses

On y voit également :

- Le niveau actuel
- Le nombre d’étoiles
- Quelques réglages (ex. sons ON/OFF en haut)

### Jouer

L’écran de jeu affiche :

- Une **seule question à la fois** (format `a + b`)
- Une barre de progression qui représente le temps restant
- Un champ de réponse + bouton `Valider`

### Mes progrès

L’écran de progrès affiche :

- Des statistiques (questions jouées, bonnes réponses, temps moyen, niveau)
- La précision (en %)
- Un graphique simple des dernières réponses
- Les récompenses (étoiles + badges)

---

## 2) Fonctionnement du jeu

### Génération des questions

Chaque question est une addition de deux entiers `a` et `b`.

- Les valeurs possibles de `a` et `b` dépendent du **niveau**.
- Plus le niveau augmente, plus l’intervalle de nombres s’agrandit.

Dans le code :

- `numberRangeForLevel(level)` définit `{ min, max }` selon le niveau
- `generateQuestion(state)` choisit deux valeurs aléatoires dans cet intervalle et calcule `answer = a + b`

### Validation de la réponse

L’enfant peut valider :

- En appuyant sur `Entrée`
- En cliquant sur `Valider`

Si la réponse est :

- **Correcte** : message positif + son joyeux (si activé) + passage rapide à la question suivante
- **Incorrecte** : message encourageant + passage automatique à la question suivante

### Absence de réponse (timeout)

Si le temps est écoulé :

- Un message du type « Pas grave ! On continue. » est affiché
- La question suivante arrive automatiquement

L’objectif est d’éviter toute impression d’“échec” bloquant.

---

## 3) Temps de réponse : comment il diminue

### Principes

Le jeu commence avec un temps de réponse de **5 secondes**.

Ensuite, ce temps peut diminuer progressivement :

- Quand le niveau augmente
- Quand l’enfant enchaîne des bonnes réponses (streak)

### Temps minimum (anti-frustration)

Le temps ne descend **jamais** sous un minimum pour rester confortable.

- Valeur par défaut : `minTimeMs = 2200ms`

### Calcul effectif dans l’app

Le temps autorisé pour une question est calculé par `calcTimeLimitMs(state)` :

- Base : `startTimeMs` (par défaut 5000ms)
- Diminution liée au niveau : plus le niveau est haut, plus le temps descend
- Diminution liée à la streak : toutes les `streakToSpeedUp` bonnes réponses, le temps diminue un peu
- Limites : clamp entre `minTimeMs` et `startTimeMs`

Ces réglages sont regroupés dans `DEFAULT_CONFIG`.

---

## 4) Progression du niveau (adaptation)

### Streak (bonnes réponses consécutives)

La progression se base d’abord sur une logique simple et lisible :

- Chaque bonne réponse augmente `streak`
- À chaque palier (`streakToLevelUp`, par défaut 5), le niveau augmente de 1

### Ajustement doux si c’est trop dur

Pour éviter que l’enfant reste bloqué à un niveau trop difficile :

- Si suffisamment de questions ont été jouées et que la précision globale devient faible, le niveau peut redescendre légèrement.

Cela permet à l’app de rester **encourageante** et de garder un bon rythme.

---

## 5) Suivi des progrès : ce qui est mesuré

Les données enregistrées servent à afficher `Mes progrès`.

### Statistiques globales

Les statistiques globales sont stockées dans `state.totals` :

- `played` : nombre de questions jouées
- `correct` : nombre de bonnes réponses
- `totalAnswerTimeMs` : somme des temps de réponse

À partir de ces valeurs, l’app calcule :

- La précision : `correct / played`
- Le temps moyen : `totalAnswerTimeMs / played`

### Historique (pour le graphique)

Chaque question ajoute une entrée dans `state.history` :

- `ts` : timestamp
- `a`, `b` : les nombres affichés
- `correct` : vrai/faux
- `answerTimeMs` : temps mis pour répondre
- `timedOut` : vrai/faux si le temps est écoulé
- `value` : valeur saisie (si disponible)

Le graphique affiche les **30 dernières questions** :

- Barre verte : réponse correcte
- Barre jaune : réponse incorrecte ou à retravailler
- Hauteur de la barre : temps de réponse relatif

---

## 6) Récompenses (étoiles et badges)

Le but est d’encourager la progression sans pression.

### Étoiles

- Une étoile est ajoutée périodiquement (logique actuelle : une étoile tous les 5 succès cumulés).

### Badges

Des badges se débloquent automatiquement selon :

- Le nombre de questions jouées (10, 25, 50, 100…)
- La précision à partir d’un certain volume de jeu (ex. 80%+, 90%+)

Les badges sont conservés dans `state.rewards.badges`.

---

## 7) Sons (activables/désactivables)

Un bouton en haut permet de passer `Sons: ON/OFF`.

- Si OFF : aucun son
- Si ON : un bip joyeux sur bonne réponse et un bip plus grave sinon

Techniquement : les sons sont générés via l’API Web Audio (`AudioContext`) pour éviter d’embarquer des fichiers audio.

---

## 8) Stockage local et mode hors-ligne

### Sauvegarde des données

Toutes les données (niveau, stats, historique, récompenses, préférences) sont stockées dans le navigateur via `localStorage`.

- Clé : `mathis_cool_state_v1`
- Pas de compte, pas de serveur

### Hors ligne

Un service worker (`sw.js`) met en cache les fichiers principaux pour que l’application fonctionne hors connexion :

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`

---

## 9) Personnalisation rapide (optionnel)

Si tu veux ajuster la difficulté/rythme, modifie `DEFAULT_CONFIG` dans `app.js` :

- `startTimeMs` : temps initial
- `minTimeMs` : minimum
- `timeStepMs` : pas de réduction
- `streakToSpeedUp` : fréquence d’accélération
- `streakToLevelUp` : fréquence d’augmentation de niveau
- `levelMax` : niveau maximum
