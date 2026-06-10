# ==========================================
# ÉTAPE 1 : BUILD (Génération du dossier dist)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Cette commande crée le dossier "dist" contenant la version optimisée
RUN npm run build 


# ==========================================
# ÉTAPE 2 : PRODUCTION (Hébergement du site)
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

# On installe "serve", un utilitaire pour héberger des fichiers statiques
RUN npm install -g serve

# On copie UNIQUEMENT le dossier dist généré à l'étape 1
# On ne copie ni le code source, ni les lourds node_modules !
COPY --from=builder /app/dist ./dist

# Expose le port 3000
EXPOSE 3000

# On lance le serveur sur le dossier "dist"
# Le flag "-s" (single) est indispensable : il redirige toutes les requêtes vers index.html,
# ce qui évite les erreurs 404 si tu rafraîchis la page.
CMD ["serve", "-s", "dist", "-l", "3000"]
