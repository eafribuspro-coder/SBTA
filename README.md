# 🚌 SBTA Platform - Système de Gestion de Transport Interurbain

Plateforme complète de gestion pour holding de transport interurbain en Côte d'Ivoire.

## 📊 Vue d'Ensemble

SBTA Platform gère l'ensemble des opérations d'une holding de transport :
- **3 sociétés** de transport (Express, Premium, Regional)
- **Personnel HOLDING** centralisé (chauffeurs, mécaniciens, guichetiers partagés)
- **Flotte de bus** appartenant aux sociétés
- **Réservations en ligne** pour clients
- **Programme de fidélité** multi-niveaux (Bronze → Platinum)
- **Gestion carburant** automatisée avec détection d'anomalies
- **Maintenance** complète (pannes, OT, stock pièces)
- **Rapports** et analyses financières
- **Temps réel** via Supabase Realtime

## 🛠️ Stack Technique

### Frontend
- **React 18** + TypeScript
- **TailwindCSS** pour le design
- **Zustand** pour state management
- **React Router v7** pour navigation
- **Recharts** pour graphiques
- **jsPDF** pour exports PDF
- **qrcode.react** pour billets
- **react-big-calendar** pour planification
- **date-fns** pour gestion dates

### Backend
- **Supabase** (PostgreSQL + Auth + RLS + Realtime + Storage)
- **Row Level Security** complet
- **Triggers** automatiques
- **Fonctions** PostgreSQL

### Déploiement
- **Vercel** pour frontend
- **Supabase Cloud** pour backend

## 🎨 Charte Graphique

- **Blanc dominant** : #FFFFFF, #F8FAF8
- **Vert SBTA** : #0B7439
- **Rouge-brique** : #AF3029
- **Règle** : Jamais vert/rouge comme fond principal (accessibilité)

## 👥 Rôles & Permissions

### Personnel HOLDING (company_id = NULL)

1. **Admin** - Accès total
2. **DAF** - Lecture seule finances
3. **Comptable** - Validation dépenses, bons carburant, OT
4. **Planificateur** - Création horaires, assignation chauffeurs/bus
5. **Chauffeur** - Bons carburant, signalement pannes
6. **Guichetier** - Réservations, embarquement, fidélité
7. **Chef Garage** - Réception pannes, contrôle qualité
8. **Mécanicien** - Diagnostic, exécution OT
9. **Pompiste** - Distribution carburant

### Gestionnaires (company_id = société)

10. **Gestionnaire** - Vision limitée à SA société

### Clients

11. **Client** - Réservations, fidélité, évaluations

## 📁 Structure du Projet

```
sbta-platform/
├── src/
│   ├── components/          # Composants réutilisables
│   │   ├── bus/            # Composants bus
│   │   ├── driver/         # Composants chauffeurs
│   │   ├── garage/         # Composants garage
│   │   ├── layout/         # Layout (Header, Sidebar)
│   │   ├── loyalty/        # Programme fidélité
│   │   └── shared/         # Composants partagés
│   ├── pages/              # Pages par rôle
│   │   ├── admin/          # Dashboard admin
│   │   ├── auth/           # Login, register
│   │   ├── chauffeur/      # Espace chauffeur
│   │   ├── client/         # Portail client
│   │   ├── comptable/      # Espace comptable
│   │   ├── daf/            # Dashboard DAF
│   │   ├── garage/         # Espace garage
│   │   ├── gestionnaire/   # Dashboard gestionnaire
│   │   ├── guichetier/     # Espace guichetier
│   │   ├── mecanicien/     # Espace mécanicien
│   │   ├── planificateur/  # Calendrier & planification
│   │   ├── pompiste/       # Espace pompiste
│   │   ├── reports/        # 9 rapports détaillés
│   │   └── stock/          # Gestion stock pièces
│   ├── services/           # Services (Supabase)
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript types
│   └── utils/              # Utilitaires
├── supabase/
│   └── migrations/         # 6 migrations SQL
├── DEPLOYMENT.md           # Guide déploiement
├── TESTING.md             # Guide tests
├── REALTIME.md            # Config Realtime
└── RLS_VERIFICATION.md    # Checklist RLS
```

## 🚀 Démarrage Rapide

### 1. Installation

```bash
npm install
```

### 2. Configuration

Créer `.env.local` :

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key
```

### 3. Développement

```bash
npm run dev
```

Ouvrir http://localhost:5173

### 4. Build Production

```bash
npm run build
```

## 📦 Déploiement

Voir **[DEPLOYMENT.md](./DEPLOYMENT.md)** pour guide complet.

### Résumé

1. **Supabase** :
   - Créer projet
   - Appliquer migrations (001 → 006)
   - Activer RLS sur toutes tables
   - Activer Realtime (schedules, reservations, etc.)
   - Charger seed data

2. **Vercel** :
   - Connecter repo GitHub
   - Configurer variables d'env
   - Déployer

## 🧪 Tests

Voir **[TESTING.md](./TESTING.md)** pour tests des 7 flux critiques.

### Flux à Tester

1. ✅ Inscription → Réservation → Paiement → QR Code → Points
2. ✅ Planification → Bon carburant auto → Validation
3. ✅ Panne → Workflow garage → Bus disponible
4. ✅ Évaluation chauffeur → Score auto-calculé
5. ✅ 10 voyages → Bon gratuit → Échange
6. ✅ 9h conduite → Repos obligatoire
7. ✅ Affichage gare temps réel (Realtime)

## 📊 Rapports Disponibles

9 rapports complets avec KPIs, graphiques et exports :

1. **Ventes** - Billets vendus, revenus, occupation
2. **Financier** - Revenus/Charges/Bénéfice par société
3. **Carburant** - Coûts, anomalies, écarts
4. **Maintenance** - Interventions, coûts, pannes fréquentes
5. **Heures chauffeurs** - Respect limites réglementaires
6. **Stock** - Valeur, ruptures, consommations
7. **Activité bus** - Km, voyages, occupation
8. **Performance chauffeurs** - Évaluations, ponctualité
9. **Fidélité** - Membres, points, engagement

## 🔒 Sécurité

- **RLS activé** sur toutes les tables
- **Politiques** spécifiques par rôle
- **Auth Supabase** avec email/password
- **Validation** comptable obligatoire
- **Audit trail** complet

Voir **[RLS_VERIFICATION.md](./RLS_VERIFICATION.md)** pour checklist.

## 🔴 Realtime

Mises à jour temps réel sans polling :

- Affichage gare
- Réservations
- Bons carburant
- Pannes
- Ordres de travail

Voir **[REALTIME.md](./REALTIME.md)** pour configuration.

## 📱 Fonctionnalités Principales

### Pour Clients

- 🔍 Recherche voyages multi-critères
- 🎫 Réservation en ligne avec QR code
- ⭐ Programme fidélité 4 niveaux
- 🎁 Catalogue récompenses
- 📝 Évaluation chauffeurs
- 📊 Historique voyages & points

### Pour Personnel

- 📅 Planification horaires
- ⛽ Gestion carburant automatisée
- 🔧 Workflow maintenance complet
- 📦 Gestion stock pièces
- 💰 Validation dépenses
- 📈 Rapports & analytics

### Pour Gestion

- 🏢 Multi-sociétés
- 👥 Personnel centralisé HOLDING
- 🚌 Flotte par société
- 💼 Finances consolidées
- 📊 9 rapports détaillés
- 🔍 Traçabilité complète

## 🎯 Règles Métier

### HOLDING

- **Personnel** : Appartient à la HOLDING (company_id = NULL)
- **Exception** : Gestionnaires ont company_id
- **Bus** : Appartiennent aux sociétés (buses.company_id)

### Validation

- **Comptable** : Valide TOUTES les dépenses
- **DAF** : Lecture seule (pas de validation)

### Fidélité

- **Bronze** : 0-1999 points
- **Silver** : 2000-4999 points
- **Gold** : 5000-9999 points
- **Platinum** : 10000+ points

### Carburant

- **Auto-création** : Bon généré à planification voyage
- **Anomalie** : Variance > 15% entre estimé/réel
- **Workflow** : Chauffeur remplit → Comptable valide

### Maintenance

- **Workflow** : Panne → Diagnostic → OT → Validation → Exécution → Contrôle
- **Bus bloqué** : Status en_panne tant que non résolu

## 🌍 Côte d'Ivoire

15 villes avec coordonnées GPS réelles :
- Abidjan (hub principal)
- Yamoussoukro (capitale politique)
- Bouaké, San-Pédro, Korhogo, Man, Daloa, Gagnoa, Abengourou, Divo, Bondoukou, Odienné, Séguéla, Touba, Soubré

## 📞 Support

Pour questions techniques :
- Supabase : https://supabase.com/docs
- React : https://react.dev
- Vite : https://vitejs.dev

## 📄 Licence

Propriétaire - SBTA Holding

---

**Version** : 1.0.0
**Dernière mise à jour** : Avril 2026
**Status** : Production Ready ✅
