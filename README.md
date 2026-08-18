# CargoMaster - Application de Gestion de Cargaison Maritime

Une application moderne et complète pour la gestion de cargaisons maritimes avec interface utilisateur intuitive, tableaux de bord analytiques et suivi en temps réel.

## 🚀 Fonctionnalités

- **📊 Tableau de Bord** - Vue d'ensemble avec métriques et graphiques
- **📦 Gestion des Cargaisons** - Suivi complet des conteneurs et expéditions
- **🚢 Planification des Voyages** - Organisation et suivi des voyages maritimes
- **📈 Rapports & Analytics** - Génération de rapports détaillés avec graphiques
- **🎨 Aperçus Design** - Maquettes et guides de style intégrés
- **📱 Design Responsive** - Compatible desktop, tablette et mobile

## 🛠️ Technologies Utilisées

- **React 18** - Framework UI moderne
- **TypeScript** - Typage statique pour plus de sécurité
- **Vite** - Build tool rapide et moderne
- **Tailwind CSS v4** - Framework CSS utility-first
- **Recharts** - Bibliothèque de graphiques pour React
- **Radix UI** - Composants accessibles et customisables
- **Lucide React** - Icônes modernes et cohérentes

## 📦 Installation

### Prérequis

- Node.js 18+ 
- npm 9+ ou yarn

### Installation des dépendances

```bash
# Cloner le repository
git clone https://github.com/N-mika/Saint-jude.git
cd Saint-jude

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## 🚀 Scripts Disponibles

```bash
# Développement
npm run dev          # Lance le serveur de développement

# Build
npm run build        # Build de production
npm run preview      # Prévisualise le build de production

# Qualité du code
npm run lint         # Vérification ESLint
npm run type-check   # Vérification TypeScript
```

## 📁 Structure du Projet

```
├── components/           # Composants React
│   ├── ui/              # Composants UI réutilisables (shadcn/ui)
│   ├── figma/           # Composants spécifiques Figma
│   ├── Dashboard.tsx    # Tableau de bord principal
│   ├── CargoManagement.tsx  # Gestion des cargaisons
│   ├── VoyagePlanning.tsx   # Planification des voyages
│   ├── Reports.tsx      # Module de rapports
│   └── ...
├── styles/              # Fichiers de style
│   └── globals.css      # Styles globaux et variables CSS
├── guidelines/          # Documentation et guides
└── public/             # Fichiers statiques
```

## 🎨 Personnalisation

### Thème et Couleurs

Les couleurs sont définies dans `/styles/globals.css` avec des variables CSS personnalisables :

```css
:root {
  --primary: #1e40af;           /* Bleu principal */
  --secondary: #dbeafe;         /* Bleu secondaire */
  --background: #ffffff;        /* Fond principal */
  --sidebar: #f8fafc;          /* Couleur sidebar */
  /* ... autres variables */
}
```

### Ajouter de Nouveaux Modules

1. Créer un nouveau composant dans `/components/`
2. L'ajouter à la navigation dans `Sidebar.tsx`
3. L'intégrer dans le routeur principal `App.tsx`

Voir `/guidelines/CustomizationGuide.md` pour plus de détails.

## 📊 Données et API

L'application utilise actuellement des données mockées. Pour intégrer vos vraies données :

1. Remplacez les données dans chaque composant
2. Créez des hooks personnalisés pour les appels API
3. Intégrez votre backend ou base de données

## 🌐 Déploiement

### Build de Production

```bash
npm run build
```

Les fichiers optimisés seront générés dans le dossier `dist/`.

### Déploiement sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

### Déploiement sur Netlify

```bash
# Build
npm run build

# Glisser-déposer le dossier dist/ sur Netlify
```

## 🔧 Configuration Avancée

### Variables d'Environnement

Créez un fichier `.env.local` :

```env
VITE_API_URL=https://votre-api.com
VITE_COMPANY_NAME=Votre Entreprise
VITE_THEME_COLOR=#1e40af
```

### Intégration Backend

L'application est prête pour l'intégration avec :
- API REST
- GraphQL
- Supabase
- Firebase
- Base de données personnalisée

## 🤝 Contribution

1. Fork le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committez vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour toute question ou problème :
- Ouvrez une issue sur GitHub
- Consultez la documentation dans `/guidelines/`
- Contactez l'équipe de développement

## 🗺️ Roadmap

- [ ] Module de suivi GPS en temps réel
- [ ] Notifications push automatiques
- [ ] Intégration API météorologique
- [ ] Mode hors-ligne avec synchronisation
- [ ] Application mobile React Native
- [ ] Rapports PDF automatiques
- [ ] Authentification multi-utilisateurs

---

Développé avec ❤️ pour la gestion maritime moderne.