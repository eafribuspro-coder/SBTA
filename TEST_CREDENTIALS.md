# Identifiants de Test - SBTA

## Important
Tous les comptes utilisent le même mot de passe: **`Password123!`**

---

## Profils Administratifs

### 1. Administrateur
- **Email:** `admin@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Admin (accès complet au système)
- **Tableau de bord:** `/admin/dashboard`
- **Analyse Performance:** `/admin/performance`

### 2. Directeur Administratif et Financier (DAF)
- **Email:** `daf@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** DAF (gestion financière et administrative)
- **Tableau de bord:** `/daf/dashboard`
- **Analyse Performance:** `/daf/performance`

### 3. Comptable
- **Email:** `comptable@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Comptable (validation dépenses, bons carburant, OT)
- **Tableau de bord:** `/comptable/dashboard`

---

## Profils Gestionnaires

### 4. Gestionnaire Express
- **Email:** `gest.express@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Gestionnaire (gestion flotte SBTA Express)
- **Tableau de bord:** `/gestionnaire/dashboard`
- **Analyse Performance:** `/gestionnaire/performance`

### 5. Gestionnaire Premium
- **Email:** `gest.premium@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Gestionnaire (gestion flotte TSR)
- **Analyse Performance:** `/gestionnaire/performance`

### 6. Gestionnaire Regional
- **Email:** `gest.regional@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Gestionnaire (gestion flotte Transport Regional)
- **Analyse Performance:** `/gestionnaire/performance`

---

## Profils Opérationnels

### 7. Planificateur
- **Email:** `planif1@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Planificateur (création et gestion des horaires)
- **Tableau de bord:** `/planificateur/dashboard`

### 8. Guichetier
- **Email:** `guichet1@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Guichetier (vente billets, caisse, rédemptions fidélité)
- **Tableau de bord:** `/guichetier/dashboard`

**Autres guichetiers disponibles:**
- `guichet2@sbta.ci`
- `guichet3@sbta.ci`
- `guichet4@sbta.ci`
- `guichet5@sbta.ci`

---

## Profils Chauffeurs

### 9. Chauffeur
- **Email:** `chauffeur1@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Chauffeur (gestion voyages, bons carburant, signalement pannes)
- **Tableau de bord:** `/chauffeur/dashboard`

**Autres chauffeurs disponibles:**
- `chauffeur2@sbta.ci` à `chauffeur10@sbta.ci`

---

## Profils Maintenance

### 10. Chef de Garage
- **Email:** `chefgarage1@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Chef de garage (gestion pannes, diagnostics, OT)
- **Tableau de bord:** `/garage/dashboard`

**Autre chef de garage:**
- `chefgarage2@sbta.ci`

### 11. Mécanicien
- **Email:** `meca1@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Mécanicien (exécution OT, diagnostic)
- **Tableau de bord:** `/mecanicien/dashboard`

**Autres mécaniciens disponibles:**
- `meca2@sbta.ci`
- `meca3@sbta.ci`
- `meca4@sbta.ci`

### 12. Pompiste
- **Email:** `pompiste1@sbta.ci`
- **Mot de passe:** `Password123!`
- **Rôle:** Pompiste (gestion ravitaillements carburant)
- **Tableau de bord:** `/pompiste/dashboard`

**Autre pompiste:**
- `pompiste2@sbta.ci`

---

## Résolution des Problèmes

### Erreur "Database error querying schema"

Cette erreur indique généralement un problème de connexion ou de permissions. Vérifiez:

1. **Connexion Internet:** Assurez-vous d'être connecté
2. **Variables d'environnement:** Le fichier `.env` doit contenir les bonnes clés Supabase
3. **Compte utilisateur:** L'utilisateur doit exister dans les tables `auth.users` ET `public.users`

### Créer un nouveau compte

Pour créer un nouveau compte de test, utilisez la page d'inscription (`/register`) qui créera automatiquement:
- Un compte dans `auth.users` (authentification)
- Un profil dans `public.users` (données utilisateur)
- Le rôle par défaut sera "client"

### Réinitialiser le mot de passe

Si vous avez oublié votre mot de passe, utilisez la fonction "Mot de passe oublié" sur la page de connexion.

---

## Notes Techniques

- **Format email:** Tous les emails utilisent le domaine `@sbta.ci`
- **Mot de passe:** Même mot de passe pour tous les comptes de test: `Password123!`
- **Sécurité:** Ces identifiants sont pour l'environnement de développement uniquement
- **Base de données:** Supabase avec RLS (Row Level Security) activé

---

## Accès Rapide aux Tableaux de Bord

| Profil | Email | Dashboard |
|--------|-------|-----------|
| Admin | admin@sbta.ci | /admin/dashboard |
| DAF | daf@sbta.ci | /daf/dashboard |
| Comptable | comptable@sbta.ci | /comptable/dashboard |
| Gestionnaire | gest.express@sbta.ci | /gestionnaire/dashboard |
| Planificateur | planif1@sbta.ci | /planificateur/dashboard |
| Guichetier | guichet1@sbta.ci | /guichetier/dashboard |
| Chauffeur | chauffeur1@sbta.ci | /chauffeur/dashboard |
| Chef Garage | chefgarage1@sbta.ci | /garage/dashboard |
| Mécanicien | meca1@sbta.ci | /mecanicien/dashboard |
| Pompiste | pompiste1@sbta.ci | /pompiste/dashboard |

---

**Date de création:** 8 Avril 2026
**Dernière mise à jour:** 8 Avril 2026
