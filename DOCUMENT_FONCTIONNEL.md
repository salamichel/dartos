# Document Fonctionnel - Application Dartos

Dartos est une application de gestion de tournois et de classement pour le jeu de fléchettes en mode **Sudden Death 301**. Elle intègre un système d'expérience (XP), de niveaux, de médailles (badges), de saisons dynamiques configurables et de guildes avec des rôles et des succès collectifs.

---

## 1. Concepts Clés de l'Application

### 1.1 Le Match de Fléchettes (Sudden Death 301)
- **Déroulement** : Les joueurs s'affrontent sur une partie de 301. 
- **Vainqueur** : Le premier joueur à atteindre exactement 0 gagne la partie. Il doit spécifier son type de fermeture (sa fléchette gagnante) : `SIMPLE`, `DOUBLE` ou `TRIPLE`.
- **Perdants** : Les autres participants sont classés selon le score restant à leur compteur (`scoreLeft`). Plus le score restant est faible, meilleur est leur classement parmi les perdants.

### 1.2 Le Système d'Expérience (XP)
Chaque match rapporte des points d'expérience aux participants (le gagnant et les perdants) selon des règles précises configurées au niveau de la saison en cours.

#### Calcul de l'XP pour le Vainqueur :
L'XP du vainqueur est calculée selon la formule suivante :
$$\text{XP}_{\text{Vainqueur}} = \text{XP}_{\text{Adversaires Battus}} + \text{Bonus Fermeture} + (\text{Somme des scores restants des perdants} \times \text{Multiplicateur Vampire}) + \text{Bonus Spéciaux}$$

1. **XP des Adversaires Battus** :
   - Par défaut : $\text{Nombre d'adversaires} \times \text{xpPerDefeatedOpponent}$.
   - Si l'option `bonusVainqueurParRang` (Vainqueur par Rang) est activée : l'XP gagnée par adversaire diminue si l'écart de niveau entre le vainqueur et le perdant est grand. La formule applique un coefficient : 
     $$\text{Facteur} = \max(0, 1 - 0.25 \times \text{Différence de Niveau})$$
     où les niveaux vont de 0 à 4.
2. **Bonus de Fermeture** (`FinishType`) :
   - Fermeture en `SIMPLE` : ajoute `xpBonusSimple`.
   - Fermeture en `DOUBLE` : ajoute `xpBonusDouble`.
   - Fermeture en `TRIPLE` : ajoute `xpBonusTriple`.
3. **Effet Vampire** :
   - Multiplie la somme de tous les points restants des perdants par `xpVampireMultiplier` et l'ajoute à l'XP du vainqueur.

#### Calcul de l'XP pour les Perdants :
Chaque perdant reçoit une XP de base de survie (`xpSurvivorBase`) à laquelle peuvent s'ajouter des bonus spéciaux selon sa performance.

### 1.3 Les Niveaux des Joueurs
L'XP cumulée d'un joueur définit son niveau et son titre :

| Titre | XP Minimum |
| :--- | :--- |
| **Pousse-Caillou** | 0 XP |
| **Lanceur du Dimanche** | 500 XP |
| **Sniper de Comptoir** | 2 000 XP |
| **Maître du 301** | 5 000 XP |
| **Phil Taylor** | 10 000 XP |

---

## 2. Médailles et Badges (Succès individuels)

Des médailles spéciales sont décernées à l'issue de chaque match selon les conditions de jeu :

### Pour le Vainqueur :
- 🐉 **TUEUR_DE_GEANTS** : Décerné si le niveau du vainqueur est strictement inférieur au niveau de l'un des perdants.
- 🐦‍🔥 **PHENIX** : Décerné si le vainqueur avait strictement moins d'XP de départ que tous les autres participants avant le match.
- 👑 **SERIAL_WINNER** : Décerné si le vainqueur enregistre sa 3ème victoire consécutive (ou plus) dans la saison en cours.

### Pour les Perdants :
- 🥈 **POULIDOR** : Décerné au joueur arrivant en 2ème position (le meilleur des perdants) si son score restant est strictement inférieur à 10.
- 🎰 **JACKPOT** : Décerné à tout perdant ayant un score restant palindrome (ex. 11, 22, 33, etc., au-delà de 9).
- 🤝 **EGALITE** (Égalité Fraternelle) : Décerné aux perdants qui terminent exactement avec le même score restant.
- 👶 **BENJAMIN** : Décerné au dernier joueur d'une partie de 3 ou 4 joueurs (3 perdants ou plus au total) si son score restant est inférieur à 50 (il a lutté dignement).

### Loterie :
- 🎟️ **LOTTERY_WINNER:[emoji]** : Des médailles spéciales peuvent être attribuées via un système de loterie post-match.

---

## 3. Les Guildes (Système Collectif)

Les joueurs peuvent s'associer au sein de guildes. Chaque guilde possède un nom, une icône de badge et une couleur de badge.

### 3.1 Rangs au sein d'une Guilde (9 Niveaux)
Chaque membre reçoit un rang automatique calculé dynamiquement au sein de sa guilde :
1. 👑✨ **Divinité du Triple** (`triple-deity`) : Le membre a l'XP la plus élevée de la guilde, possède au moins 10 000 XP et 10 badges au total.
2. 👑 **Maître Suprême** (`supreme-master`) : Le membre a l'XP la plus élevée de la guilde, OU possède au moins 10 000 XP et 5 badges au total.
3. 🐉 **Tueur de Dragons** (`dragon-slayer`) : Au moins 5 000 XP, possède le badge `TUEUR_DE_GEANTS`, et au moins 8 badges au total.
4. ⚔️ **Champion d'Élite** (`elite-champion`) : Au moins 5 000 XP, OU possède le badge `TUEUR_DE_GEANTS` et 4 badges au total.
5. 🛡️🔥 **Vétéran Légendaire** (`legendary-veteran`) : Au moins 3 000 XP et 6 badges au total.
6. 🏰 **Vétéran Couronné** (`crowned-veteran`) : Au moins 2 000 XP OU 3 badges au total.
7. 🎖️ **Lanceur Initié** (`initiated-thrower`) : Au moins 1 000 XP OU 2 badges au total.
8. 🏹 **Écuyer de l'Arène** (`arena-squire`) : Au moins 500 XP OU 1 badge au total.
9. 👤 **Recrue** (`recruit`) : Par défaut pour les nouveaux ou ceux ne remplissant pas les critères ci-dessus.

### 3.2 Succès Collectifs de la Guilde (Hauts Faits)
Les guildes débloquent des badges collectifs calculés à partir de la somme des performances de leurs membres :
- 🥉 **Apprentis de la Fléchette** : XP collective de la guilde $\ge$ 500 XP.
- 🥈 **Champions en Devenir** : XP collective de la guilde $\ge$ 2 000 XP.
- 🥇 **Légendes Vivantes** : XP collective de la guilde $\ge$ 10 000 XP.
- ⚔️ **Conquérants** : Nombre total de victoires individuelles cumulées par les membres $\ge$ 10.
- 🐉 **Tanière des Géants** : Au moins un membre de la guilde possède le titre individuel de niveau Maître (XP $\ge$ 5000).

---

## 4. API de l'Application (Liste des Endpoints)

L'API est construite avec Express et utilise Prisma pour interagir avec la base de données PostgreSQL/MySQL.

### 4.1 Diagnostic / Santé
- **`GET /health`** : Vérifie l'état de l'API.
  - *Réponse* : `{"status": "ok"}`

### 4.2 Joueurs (`/players`)
- **`GET /players`** : Récupère la liste de tous les joueurs avec leurs statistiques globales calculées (XP totale, nombre de matchs, badges uniques et cumulés, niveau, guildes).
- **`POST /players`** : Crée un nouveau joueur.
  - *Payload* : `{ "name": "NomDuJoueur" }`
- **`PATCH /players/:id`** : Modifie les informations d'un joueur existant (par exemple son nom).
  - *Payload* : `{ "name": "NouveauNom" }`

### 4.3 Saisons (`/seasons`)
- **`GET /seasons`** : Liste toutes les saisons triées de la plus récente à la plus ancienne.
- **`POST /seasons`** : Crée une nouvelle saison avec ses paramètres d'XP spécifiques.
  - *Payload* : Paramètres d'XP personnalisés (ex: `startedAt`, `name`, `xpPerDefeatedOpponent`, etc.).
- **`GET /seasons/:id/leaderboard`** : Génère le classement (Leaderboard) pour une saison donnée en calculant l'XP totale accumulée uniquement durant cette saison, le taux de victoire, et l'XP moyenne par match.
- **`PATCH /seasons/:id`** *(Admin)* : Modifie les configurations d'XP d'une saison et déclenche un recalcul automatique de l'XP de tous les matchs de cette saison.
- **`DELETE /seasons/:id`** *(Admin)* : Supprime une saison.
- **`POST /seasons/:id/recalculate`** *(Admin)* : Force le recalcul de l'XP de tous les matchs rattachés à cette saison.

### 4.4 Matchs (`/matches`)
- **`GET /matches`** : Liste tous les matchs joués (possibilité de filtrer par saison via `?seasonId=ID`).
- **`POST /matches`** : Enregistre un match terminé. Calcule automatiquement l'XP de chaque joueur et attribue les médailles méritées en fonction de la saison active.
  - *Payload* :
    ```json
    {
      "playedAt": "2026-06-07T10:00:00.000Z", // Optionnel
      "seasonId": 1, // Optionnel (déduit selon la date si omis)
      "winner": {
        "playerId": 1,
        "finishType": "DOUBLE"
      },
      "losers": [
        { "playerId": 2, "scoreLeft": 24 },
        { "playerId": 3, "scoreLeft": 55 }
      ]
    }
    ```
- **`PUT /matches/:id`** *(Admin)* : Met à jour un match existant et recalcule l'XP associée.
- **`DELETE /matches/:id`** *(Admin)* : Supprime un match.
- **`POST /matches/:id/lottery`** : Enregistre un bonus d'XP de loterie pour certains participants du match et leur décerne les médailles de loterie correspondantes.
  - *Payload* :
    ```json
    {
      "playerGains": [
        { "playerId": 1, "xpBonus": 50, "emojis": ["🎉", "⭐"] }
      ]
    }
    ```

### 4.5 Classement Global (`/leaderboard`)
- **`GET /leaderboard`** : Récupère le classement général de tous les joueurs de l'application (toutes saisons confondues), trié par XP totale décroissante.

### 4.6 Guildes (`/guilds`)
- **`GET /guilds`** : Récupère la liste de toutes les guildes avec leurs statistiques collectives calculées, leurs succès collectifs débloqués et la liste de leurs membres triés par XP avec leur rôle/titre dynamique calculé.
- **`POST /guilds`** : Crée une nouvelle guilde.
  - *Payload* : `{ "name": "Nom", "badgeIcon": "🛡️", "badgeColor": "#FF5733" }`
- **`PATCH /guilds/:id`** *(Admin)* : Met à jour les détails d'une guilde (nom, icône, couleur).
- **`DELETE /guilds/:id`** *(Admin)* : Supprime une guilde.
- **`POST /guilds/:id/members`** : Ajoute un joueur en tant que membre dans une guilde.
  - *Payload* : `{ "playerId": 1 }`
- **`DELETE /guilds/:id/members/:playerId`** : Exclut/retire un membre d'une guilde.

---

## 5. Sécurité et Middleware
Les routes d'administration marquées *(Admin)* nécessitent la validation d'un mot de passe administrateur via un middleware dédié (`requireAdminPassword`). Ce mot de passe est généralement transmis dans les en-têtes (Headers) de la requête.