# Utilise une image de base Node.js pour le build et l'exécution de l'application
FROM node:20-alpine AS development

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie les fichiers package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste du code source de l'application
COPY . .

# Expose le port sur lequel l'application Vite s'exécute
EXPOSE 3000

# Commande pour démarrer l'application en mode développement
# Le script 'dev' de package.json utilise le port 3000 et l'hôte 0.0.0.0
CMD ["npm", "run", "dev"]

# Image finale pour la production (optionnel, mais bonne pratique)
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "dev"]