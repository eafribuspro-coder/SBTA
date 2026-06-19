# SBTA Platform - Guide de Tests

## 🧪 Flux Critiques à Tester

### ✅ Flux 1 : Inscription Client → Réservation → Paiement → QR Code → Points Fidélité

**Objectif** : Valider le parcours complet client

#### Étapes :

1. **Inscription client**
   - Aller sur `/register`
   - Remplir : nom, email, téléphone, mot de passe
   - Vérifier : compte créé avec rôle `client`, tier `bronze`, 0 points

2. **Recherche voyage**
   - Se connecter avec le compte client
   - Aller sur `/client/search`
   - Sélectionner : Abidjan → Yamoussoukro
   - Choisir une date
   - Cliquer **Rechercher**
   - Vérifier : liste des horaires disponibles

3. **Réservation**
   - Cliquer **Réserver** sur un horaire
   - Sélectionner des sièges (ex: A1, A2)
   - Remplir passagers
   - Vérifier : prix total affiché

4. **Paiement**
   - Choisir mode de paiement (Orange Money / MTN / Wave)
   - Entrer numéro
   - Cliquer **Payer**
   - Vérifier : statut → `payee`, QR code généré

5. **Points fidélité**
   - Vérifier table `loyalty_points_log` :
     - Nouvelle entrée avec `points_change` = distance/100
   - Vérifier `users.loyalty_points` incrémenté
   - Vérifier calcul tier automatique

**Résultat attendu** : ✅ Réservation créée, payée, QR code disponible, points crédités

---

### ✅ Flux 2 : Planification → Bon Carburant Auto → Remplissage → Validation

**Objectif** : Valider le workflow carburant automatique

#### Étapes :

1. **Planification voyage** (Planificateur)
   - Se connecter comme `planif1@sbta.ci`
   - Aller sur `/planificateur/calendar`
   - Créer un nouveau voyage :
     - Route : Abidjan → Bouaké
     - Bus : AB-1234-CI
     - Chauffeur : Kouamé CHAUFFEUR 1
     - Date/heure départ
   - Sauvegarder
   - **VÉRIFIER** : Trigger auto-création bon carburant

2. **Vérification bon auto-généré**
   - Table `fuel_vouchers` :
     - Nouveau bon créé
     - `status` = `en_attente`
     - `estimated_amount` calculé (distance × 0.35L × prix/L)
     - `bus_id`, `driver_id`, `schedule_id` renseignés

3. **Chauffeur remplit bon**
   - Se connecter comme `chauffeur1@sbta.ci`
   - Aller sur `/chauffeur/fuel-vouchers`
   - Cliquer sur le bon en attente
   - Remplir :
     - Station : Total Abidjan Nord
     - Ville : Abidjan
     - Litres réels : 135L
     - Prix/L : 650 FCFA
   - Uploader photo (optionnel)
   - Soumettre
   - **VÉRIFIER** : `status` → `soumis`

4. **Comptable valide**
   - Se connecter comme `comptable@sbta.ci`
   - Aller sur `/comptable/fuel-vouchers`
   - Voir le bon `soumis`
   - Vérifier anomalies (variance > 15%)
   - Cliquer **Valider**
   - **VÉRIFIER** : `status` → `validee`, `validated_at` renseigné

**Résultat attendu** : ✅ Bon créé auto, rempli par chauffeur, validé par comptable

---

### ✅ Flux 3 : Panne → Workflow Garage Complet → Bus Disponible

**Objectif** : Valider le workflow maintenance complet

#### Étapes :

1. **Chauffeur signale panne**
   - Se connecter comme `chauffeur1@sbta.ci`
   - Aller sur `/chauffeur/breakdown`
   - Remplir :
     - Bus : AB-1234-CI
     - Localisation : Autoroute Yamoussoukro
     - Description : Surchauffe moteur
     - Gravité : Haute
   - Uploader photo
   - Soumettre
   - **VÉRIFIER** : `breakdown_reports` créé, `status` = `signale`, bus → `en_panne`

2. **Chef garage reçoit**
   - Se connecter comme `chefgarage1@sbta.ci`
   - Aller sur `/garage/breakdown-receive`
   - Voir panne signalée
   - Cliquer **Réceptionner**
   - Assigner mécanicien : Touré MECANICIEN 1
   - **VÉRIFIER** : `status` → `en_cours`, mécanicien assigné

3. **Mécanicien diagnostique**
   - Se connecter comme `meca1@sbta.ci`
   - Aller sur `/mecanicien/diagnostic`
   - Voir la panne assignée
   - Effectuer diagnostic :
     - Type panne : Refroidissement
     - Pièces nécessaires : Radiateur, liquide
     - Temps estimé : 4h
     - Coût estimé : 85000 FCFA
   - Soumettre
   - **VÉRIFIER** : OT créé automatiquement, `status` = `en_attente_validation`

4. **Comptable valide OT**
   - Se connecter comme `comptable@sbta.ci`
   - Aller sur `/comptable/work-orders`
   - Voir OT en attente
   - Vérifier budget
   - Cliquer **Valider**
   - **VÉRIFIER** : `status` → `validee`

5. **Mécanicien travaille**
   - Se connecter comme `meca1@sbta.ci`
   - Aller sur `/mecanicien/work-order-execute`
   - Démarrer travail
   - Consommer pièces du stock
   - Terminer
   - Entrer coût réel : 82000 FCFA
   - **VÉRIFIER** : `status` → `terminee`, stock décrémenté

6. **Contrôle qualité**
   - Se connecter comme `chefgarage1@sbta.ci`
   - Aller sur `/garage/quality-check`
   - Voir OT terminée
   - Faire tests
   - Approuver
   - **VÉRIFIER** : `status` → `approuvee`, bus → `disponible`

**Résultat attendu** : ✅ Workflow complet, bus retour en service

---

### ✅ Flux 4 : Voyage Terminé → Évaluation → Points Chauffeur

**Objectif** : Valider système d'évaluation chauffeurs

#### Étapes :

1. **Voyage terminé**
   - Créer une réservation complétée (via seed ou manuellement)
   - Assurer `schedule.status` = `termine`

2. **Client reçoit invitation**
   - Se connecter comme client
   - Aller sur `/client/review`
   - Voir voyages à évaluer

3. **Client évalue**
   - Sélectionner voyage
   - Noter :
     - Ponctualité : 5/5
     - Confort : 4/5
     - Conduite : 5/5
     - Service : 4/5
   - Commentaire : "Excellent voyage, chauffeur très professionnel"
   - Soumettre
   - **VÉRIFIER** : `driver_reviews` créé

4. **Points chauffeur mis à jour**
   - Vérifier `users` (chauffeur) :
     - `performance_score` recalculé (trigger auto)
     - `total_reviews` incrémenté
   - Vérifier `driver_daily_performance` :
     - Moyenne journalière mise à jour

5. **Niveau recalculé**
   - Si score ≥ 4.8 → excellent
   - Si score ≥ 4.5 → très bon
   - Si score ≥ 4.0 → bon
   - Sinon → à améliorer

**Résultat attendu** : ✅ Évaluation enregistrée, score chauffeur auto-calculé

---

### ✅ Flux 5 : 10 Voyages → Bon Gratuit → Échange Guichet

**Objectif** : Valider récompenses fidélité

#### Étapes :

1. **Client cumule voyages**
   - Utiliser compte avec ≥10 voyages (ex: client01@gmail.com - 45 voyages)
   - Vérifier `users.total_trips` ≥ 10

2. **Bon généré automatiquement**
   - Vérifier table `loyalty_rewards_catalog` :
     - Récompense "Voyage gratuit" existe (500 points)
   - Client échange points via `/client/rewards`

3. **Échange au guichet**
   - Se connecter comme `guichet1@sbta.ci`
   - Aller sur `/guichetier/loyalty-redemption`
   - Scanner QR code récompense du client
   - Valider échange
   - **VÉRIFIER** :
     - `loyalty_redemptions.status` → `utilisee`
     - Points client décrémentes
     - Nouvelle réservation créée gratuitement

**Résultat attendu** : ✅ Bon généré, échangé, voyage gratuit créé

---

### ✅ Flux 6 : Chauffeur 9h Conduite → Repos Obligatoire

**Objectif** : Valider limites réglementaires

#### Étapes :

1. **Créer historique 9h**
   - Chauffeur a déjà effectué 9h de conduite aujourd'hui
   - Vérifier table `schedules` :
     - Somme `EXTRACT(EPOCH FROM (arrival_date - departure_date))/3600` ≥ 9

2. **Vérifier statut auto**
   - Trigger doit mettre `users.driver_status` → `repos_obligatoire`

3. **Planificateur bloqué**
   - Se connecter comme `planif1@sbta.ci`
   - Aller sur `/planificateur/new-schedule`
   - Essayer d'assigner ce chauffeur
   - **VÉRIFIER** : Message d'erreur "Chauffeur en repos obligatoire"
   - Chauffeur grisé/désactivé dans liste

4. **Retour disponible**
   - Après 11h de repos (simuler en modifiant date)
   - Trigger remet `driver_status` → `disponible`

**Résultat attendu** : ✅ Limites respectées, blocage planification

---

### ✅ Flux 7 : Affichage Gare → Temps Réel (Realtime)

**Objectif** : Valider Supabase Realtime

#### Étapes :

1. **Préparer**
   - Activer Realtime sur table `schedules` dans Supabase Dashboard
   - Vérifier code utilise `.on('postgres_changes')`

2. **Ouvrir affichage**
   - Aller sur `/display/station` (écran gare)
   - Noter horaires affichés

3. **Modifier depuis autre onglet**
   - Ouvrir nouvel onglet
   - Se connecter comme planificateur
   - Créer nouveau voyage
   - OU modifier statut voyage existant (en cours → terminé)

4. **Vérifier mise à jour**
   - Retour onglet affichage
   - **VÉRIFIER** : Affichage mis à jour SANS recharger page
   - Nouveau voyage apparaît immédiatement

**Résultat attendu** : ✅ Mise à jour temps réel sans F5

---

## 🔍 Tests Supplémentaires

### Sécurité RLS

- [ ] Client ne peut pas voir réservations autres clients
- [ ] Chauffeur ne peut modifier que ses propres bons carburant
- [ ] Comptable peut tout voir mais pas supprimer
- [ ] DAF peut uniquement lire (pas écrire)
- [ ] Gestionnaire voit seulement sa société

### Performance

- [ ] Liste 1000 réservations < 2s
- [ ] Recherche voyages < 1s
- [ ] Rapport financier < 3s

### UX

- [ ] Toutes pages responsive (mobile/tablet/desktop)
- [ ] Messages toast pour succès/erreur
- [ ] Loading states partout
- [ ] Pas d'erreurs console

## 📊 Rapports de Test

Documenter pour chaque flux :
- ✅ / ❌ Statut
- Captures d'écran
- Anomalies trouvées
- Temps d'exécution
