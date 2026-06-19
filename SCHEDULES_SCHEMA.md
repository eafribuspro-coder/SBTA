# Schéma de la table Schedules

## Structure de la table

La table `schedules` contient les informations sur les voyages planifiés dans le système.

### Colonnes principales

| Colonne | Type | Description | Nullable | Défaut |
|---------|------|-------------|----------|--------|
| `id` | uuid | Identifiant unique | Non | `uuid_generate_v4()` |
| `route_id` | uuid | Référence vers la route | Oui | - |
| `bus_id` | uuid | Référence vers le bus | Oui | - |
| `driver_id` | uuid | Référence vers le chauffeur principal | Oui | - |
| `copilot_id` | uuid | Référence vers le copilote (optionnel) | Oui | - |
| `departure_station_id` | uuid | Station de départ | Oui | - |
| `arrival_station_id` | uuid | Station d'arrivée | Oui | - |
| `boarding_point_id` | uuid | Point d'embarquement | Oui | - |
| `departure_datetime` | timestamptz | Date et heure de départ | Non | - |
| `arrival_datetime` | timestamptz | Date et heure d'arrivée | Non | - |
| `price` | numeric | Prix du billet | Oui | - |
| `status` | text | Statut du voyage | Oui | `'planifie'` |
| `seats_available` | integer | Places disponibles | Oui | - |
| `seats_reserved` | integer | Places réservées | Oui | `0` |
| `fill_rate` | numeric(5,2) | Taux de remplissage (0-100) | Oui | `0` |
| `route_name` | text | Nom de la route (dénormalisé) | Oui | - |
| `estimated_duration_minutes` | integer | Durée estimée en minutes | Oui | - |
| `is_recurring` | boolean | Voyage récurrent | Oui | `false` |
| `recurrence_pattern` | jsonb | Modèle de récurrence | Oui | - |
| `parent_schedule_id` | uuid | Lien vers le voyage parent | Oui | - |
| `notes` | text | Notes du planificateur | Oui | - |
| `created_by` | uuid | Créateur du voyage | Oui | - |
| `created_at` | timestamptz | Date de création | Oui | `now()` |
| `updated_at` | timestamptz | Date de modification | Oui | `now()` |

## Statuts possibles

- `planifie` : Voyage planifié (par défaut)
- `en_cours` : Voyage en cours
- `termine` : Voyage terminé
- `annule` : Voyage annulé

## Contraintes automatiques

### 1. Contraintes de validation
- `arrival_datetime` doit être **après** `departure_datetime`
- `fill_rate` doit être entre **0 et 100**
- `driver_id` doit être **différent** de `copilot_id`

### 2. Références (Foreign Keys)
- `route_id` → `routes(id)` ON DELETE SET NULL
- `bus_id` → `buses(id)` ON DELETE SET NULL
- `driver_id` → `users(id)` ON DELETE SET NULL
- `copilot_id` → `users(id)` ON DELETE SET NULL
- `departure_station_id` → `stations(id)` ON DELETE SET NULL
- `arrival_station_id` → `stations(id)` ON DELETE SET NULL
- `boarding_point_id` → `boarding_points(id)` ON DELETE SET NULL
- `parent_schedule_id` → `schedules(id)` ON DELETE CASCADE
- `created_by` → `users(id)` ON DELETE SET NULL

## Fonctions automatiques (Triggers)

### 1. Auto-extraction des informations de route
**Trigger:** `trigger_auto_extract_route_info`
**Fonction:** `auto_extract_route_info()`

- Extrait automatiquement `route_name` depuis la table `routes`
- Calcule automatiquement `estimated_duration_minutes` depuis la route ou la différence de temps

### 2. Calcul automatique du taux de remplissage
**Trigger:** `trigger_auto_calculate_fill_rate`
**Fonction:** `auto_calculate_fill_rate()`

- Compte les réservations avec statut `confirmed` ou `boarded`
- Calcule `fill_rate` = (réservations / capacité du bus) × 100
- Met à jour `seats_reserved` et `seats_available`

### 3. Validation des conflits
**Trigger:** `trigger_validate_schedule_conflicts`
**Fonction:** `validate_schedule_conflicts()`

- Vérifie la disponibilité du bus (statut + conflits horaires)
- Vérifie la disponibilité du chauffeur (heures légales + conflits)
- Vérifie la disponibilité du copilote si présent
- **Bloque l'insertion/modification** si conflits détectés

## Fonctions utilitaires

### 1. `check_bus_availability()`
Vérifie qu'un bus est disponible pour un créneau horaire donné.

**Paramètres:**
- `p_bus_id` : UUID du bus
- `p_departure_datetime` : Date/heure de départ
- `p_arrival_datetime` : Date/heure d'arrivée
- `p_schedule_id` : UUID du voyage (pour exclure lors de modification)

**Retour:**
- `is_available` : boolean
- `conflict_schedule_id` : UUID du voyage en conflit
- `conflict_message` : Message d'erreur

**Vérifications:**
- Statut du bus = 'active'
- Aucun chevauchement horaire avec d'autres voyages

### 2. `check_driver_availability()`
Vérifie qu'un chauffeur est disponible et respecte les heures légales.

**Paramètres:**
- `p_driver_id` : UUID du chauffeur
- `p_departure_datetime` : Date/heure de départ
- `p_arrival_datetime` : Date/heure d'arrivée
- `p_schedule_id` : UUID du voyage (pour exclure lors de modification)

**Retour:**
- `is_available` : boolean
- `conflict_schedule_id` : UUID du voyage en conflit
- `conflict_message` : Message d'erreur
- `hours_today` : Heures travaillées aujourd'hui
- `hours_week` : Heures travaillées cette semaine
- `hours_remaining_today` : Heures restantes aujourd'hui

**Vérifications:**
- Chauffeur actif (is_active = true)
- Aucun chevauchement horaire
- Limite quotidienne : **9 heures maximum**
- Limite hebdomadaire : **48 heures maximum**

## Index pour performance

```sql
CREATE INDEX idx_schedules_departure_datetime ON schedules(departure_datetime);
CREATE INDEX idx_schedules_bus_id ON schedules(bus_id);
CREATE INDEX idx_schedules_driver_id ON schedules(driver_id);
CREATE INDEX idx_schedules_copilot_id ON schedules(copilot_id);
CREATE INDEX idx_schedules_route_id ON schedules(route_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_parent_id ON schedules(parent_schedule_id);
CREATE INDEX idx_schedules_bus_datetime ON schedules(bus_id, departure_datetime, arrival_datetime);
CREATE INDEX idx_schedules_driver_datetime ON schedules(driver_id, departure_datetime, arrival_datetime);
CREATE INDEX idx_schedules_copilot_datetime ON schedules(copilot_id, departure_datetime, arrival_datetime);
```

## Politiques RLS (Row Level Security)

La table a RLS activé avec les politiques suivantes :

### SELECT (Lecture)
- **"Anyone can view schedules"** : Tout le monde peut voir les voyages

### INSERT (Création)
- **"Planificateur can insert schedules"** : Seuls les planificateurs peuvent créer

### UPDATE (Modification)
- **"Planificateur can update schedules"** : Les planificateurs peuvent modifier
- **"Chauffeur can update own schedules"** : Les chauffeurs peuvent modifier leurs propres voyages
- **"Copilot can update own schedules"** : Les copilotes peuvent modifier leurs voyages

### DELETE (Suppression)
- **"Admin can delete schedules"** : Seuls les admins peuvent supprimer

## Exemple d'utilisation

### Créer un nouveau voyage

```sql
INSERT INTO schedules (
  route_id,
  bus_id,
  driver_id,
  copilot_id,
  departure_datetime,
  arrival_datetime,
  price
) VALUES (
  'route-uuid',
  'bus-uuid',
  'driver-uuid',
  'copilot-uuid',  -- Optionnel
  '2026-04-10 08:00:00+00',
  '2026-04-10 12:00:00+00',
  5000
);
```

**Notes:**
- `route_name`, `estimated_duration_minutes`, `fill_rate` sont calculés automatiquement
- `seats_available` et `seats_reserved` sont calculés depuis le bus
- Les conflits sont vérifiés automatiquement avant insertion

### Vérifier la disponibilité d'un bus

```sql
SELECT * FROM check_bus_availability(
  'bus-uuid',
  '2026-04-10 08:00:00+00',
  '2026-04-10 12:00:00+00'
);
```

### Vérifier la disponibilité d'un chauffeur

```sql
SELECT * FROM check_driver_availability(
  'driver-uuid',
  '2026-04-10 08:00:00+00',
  '2026-04-10 12:00:00+00'
);
```

## Migration vers le nouveau schéma

Si vous avez des anciennes colonnes (`departure_time`, `arrival_time`, `price_standard`, etc.), elles ne sont plus utilisées. Le nouveau schéma utilise :

- `departure_datetime` au lieu de `departure_time`
- `arrival_datetime` au lieu de `arrival_time`
- `price` au lieu de `price_standard`, `price_vip`, `price_executive`
- `seats_available` au lieu de `available_seats`

## Service frontend (TypeScript)

Un service centralisé est disponible dans `src/services/scheduleValidation.ts` :

```typescript
import { validateSchedule, getAvailableBuses, getAvailableDrivers } from '@/services/scheduleValidation';

// Valider un voyage
const result = await validateSchedule(
  routeId,
  busId,
  driverId,
  copilotId,
  departureDateTime,
  arrivalDateTime
);

// Obtenir les bus disponibles
const buses = await getAvailableBuses(departureDateTime, arrivalDateTime);

// Obtenir les chauffeurs disponibles
const drivers = await getAvailableDrivers(departureDateTime, arrivalDateTime);
```
