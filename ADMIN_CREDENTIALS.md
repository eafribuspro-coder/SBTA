# 🔐 Compte Administrateur SBTA

## Identifiants Admin

**Email**: `admin@sbta.ci`
**Mot de passe**: `Admin@SBTA2026`

## Instructions de Première Connexion

1. Aller sur la plateforme SBTA
2. Cliquer sur "Se connecter"
3. Entrer les identifiants ci-dessus
4. Vous serez connecté avec tous les droits d'administration

## Création du Compte

Pour créer ce compte dans Supabase :

### Option 1 : Via Supabase Dashboard (Recommandé)

1. Aller dans **Authentication** > **Users**
2. Cliquer sur **Add user** > **Create new user**
3. Entrer :
   - Email: `admin@sbta.ci`
   - Password: `Admin@SBTA2026`
   - ✅ Auto Confirm User (cocher cette case)
4. Cliquer **Create user**
5. Copier l'UUID généré
6. Aller dans **SQL Editor**
7. Exécuter ce SQL (remplacer `<UUID-COPIÉ>` par l'UUID) :

```sql
INSERT INTO users (
  id,
  email,
  full_name,
  phone,
  role,
  company_id,
  is_active
) VALUES (
  '<UUID-COPIÉ>',
  'admin@sbta.ci',
  'Administrateur SBTA',
  '+225 07 00 00 00 01',
  'admin',
  NULL,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;
```

### Option 2 : Via Page d'Inscription

1. Aller sur `/register`
2. S'inscrire avec :
   - Nom complet: Administrateur SBTA
   - Email: admin@sbta.ci
   - Téléphone: +225 07 00 00 00 01
   - Mot de passe: Admin@SBTA2026
3. Après inscription, aller dans Supabase Dashboard > SQL Editor
4. Exécuter ce SQL pour changer le rôle en admin :

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'admin@sbta.ci';
```

## Permissions Admin

Avec le rôle `admin`, vous avez accès à :

✅ **Gestion complète**
- Toutes les sociétés
- Tous les bus
- Tous les utilisateurs
- Tous les itinéraires
- Toutes les réservations

✅ **Rapports**
- 9 rapports détaillés (ventes, finances, carburant, maintenance, etc.)

✅ **Configuration**
- Configurations de sièges
- Rôles et permissions
- Programmes fidélité
- Catalogue récompenses

✅ **Finances**
- Visualisation complète
- Validation dépenses (avec comptable)

✅ **Opérations**
- Planification voyages
- Gestion maintenance
- Stock pièces détachées
- Bons carburant

## Sécurité

⚠️ **IMPORTANT** :
- Changez le mot de passe après la première connexion
- Ne partagez jamais ces identifiants
- Utilisez un gestionnaire de mots de passe
- Activez la double authentification (2FA) si disponible

## Autres Comptes de Test

Voir `DEPLOYMENT.md` section "Comptes de Test" pour tous les comptes disponibles (DAF, Comptable, Gestionnaires, Chauffeurs, Clients, etc.)

---

**Créé le** : 7 avril 2026
**Plateforme** : SBTA Transport System
