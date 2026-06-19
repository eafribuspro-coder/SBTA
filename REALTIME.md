# SBTA Platform - Configuration Realtime

## 🔴 Supabase Realtime - Guide Complet

Supabase Realtime permet d'écouter les changements de la base de données en temps réel sans polling.

## 📋 Tables à Activer pour Realtime

### Configuration dans Supabase Dashboard

1. Aller dans **Database** > **Replication**
2. Activer les tables suivantes :

#### Tables Critiques (Haute Priorité)

| Table | Raison | Utilisation |
|-------|--------|-------------|
| `schedules` | Affichage gare temps réel | Écran `/display/station` |
| `reservations` | Réservations en direct | Dashboard guichetier |
| `buses` | Statuts bus (disponible/panne) | Dashboard admin, planificateur |
| `fuel_vouchers` | Bons carburant | Comptable, pompiste |
| `breakdown_reports` | Pannes signalées | Chef garage |
| `maintenance_work_orders` | Ordres de travail | Mécaniciens, comptable |

#### Tables Secondaires (Optionnel)

| Table | Raison |
|-------|--------|
| `driver_reviews` | Nouvelles évaluations |
| `loyalty_redemptions` | Échanges fidélité |
| `expenses` | Nouvelles dépenses |
| `stock_movements` | Mouvements stock |

## 💻 Implémentation Frontend

### 1. Configuration Client Supabase

Le client est déjà configuré dans `/src/services/supabase.ts` :

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
```

### 2. Écouter les Changements

#### Exemple : Affichage Gare

```typescript
// src/pages/display/StationDisplay.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export default function StationDisplay() {
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    // Chargement initial
    loadSchedules();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('schedules-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'schedules'
        },
        (payload) => {
          console.log('Changement détecté:', payload);

          if (payload.eventType === 'INSERT') {
            setSchedules(prev => [...prev, payload.new]);
          }

          if (payload.eventType === 'UPDATE') {
            setSchedules(prev => prev.map(s =>
              s.id === payload.new.id ? payload.new : s
            ));
          }

          if (payload.eventType === 'DELETE') {
            setSchedules(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .order('departure_date');

    setSchedules(data || []);
  };

  return (
    <div>
      {schedules.map(schedule => (
        <div key={schedule.id}>
          {schedule.route_name} - {schedule.departure_time}
        </div>
      ))}
    </div>
  );
}
```

#### Exemple : Bons Carburant (Comptable)

```typescript
// src/pages/comptable/FuelVouchers.tsx
useEffect(() => {
  loadVouchers();

  const channel = supabase
    .channel('fuel-vouchers-comptable')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'fuel_vouchers',
        filter: `status=eq.soumis` // Seulement les nouveaux soumis
      },
      (payload) => {
        // Notification toast
        toast.info('Nouveau bon carburant à valider');

        // Mettre à jour liste
        loadVouchers();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

#### Exemple : Pannes (Chef Garage)

```typescript
// src/pages/garage/BreakdownReceive.tsx
useEffect(() => {
  const channel = supabase
    .channel('breakdowns-garage')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'breakdown_reports'
      },
      (payload) => {
        // Alert sonore + notification
        playAlertSound();
        toast.error(`🚨 Nouvelle panne signalée: ${payload.new.bus_license_plate}`);

        // Ajouter à la liste
        setBreakdowns(prev => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### 3. Filtres Avancés

#### Par Société (Gestionnaire)

```typescript
const companyId = user.company_id;

const channel = supabase
  .channel('schedules-company')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'schedules',
      filter: `company_id=eq.${companyId}`
    },
    handleChange
  )
  .subscribe();
```

#### Par Date

```typescript
const today = new Date().toISOString().split('T')[0];

const channel = supabase
  .channel('schedules-today')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'schedules',
      filter: `departure_date=gte.${today}`
    },
    handleChange
  )
  .subscribe();
```

## 🎯 Use Cases Principaux

### 1. Affichage Gare (Temps Réel Critique)

**Tables** : `schedules`, `buses`

**Fonctionnalité** :
- Nouveau voyage ajouté → apparaît immédiatement
- Retard signalé → affichage mis à jour
- Voyage annulé → disparaît

### 2. Dashboard Guichetier

**Tables** : `reservations`, `schedules`

**Fonctionnalité** :
- Nouvelle réservation en ligne → compteur mis à jour
- Places restantes → affichage dynamique
- Embarquement → statuts temps réel

### 3. Workflow Maintenance

**Tables** : `breakdown_reports`, `maintenance_work_orders`

**Fonctionnalité** :
- Panne signalée → alerte chef garage
- OT validé → notif mécanicien
- Travail terminé → notif contrôle qualité

### 4. Validation Comptable

**Tables** : `fuel_vouchers`, `expenses`, `maintenance_work_orders`

**Fonctionnalité** :
- Nouveau bon soumis → badge notification
- Dépense créée → liste mise à jour
- OT en attente validation → alerte

## ⚠️ Bonnes Pratiques

### 1. Cleanup des Channels

**TOUJOURS** nettoyer les channels dans `useEffect` cleanup :

```typescript
useEffect(() => {
  const channel = supabase.channel('my-channel');
  // ... subscribe

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### 2. Éviter les Doublons

Utiliser des noms de channels uniques par composant :

```typescript
// ❌ Mauvais
const channel = supabase.channel('changes');

// ✅ Bon
const channel = supabase.channel('schedules-display-page');
```

### 3. Limiter les Events

Filtrer au maximum pour éviter surcharge :

```typescript
// ❌ Écoute TOUT
.on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' })

// ✅ Seulement nouveaux et mis à jour
.on('postgres_changes', {
  event: ['INSERT', 'UPDATE'],
  schema: 'public',
  table: 'schedules',
  filter: 'status=eq.actif'
})
```

### 4. Throttling

Pour éviter trop de re-renders :

```typescript
import { debounce } from 'lodash';

const handleChange = debounce((payload) => {
  // Traitement
}, 500);
```

## 🔧 Debugging

### Vérifier connexion Realtime

```typescript
const channel = supabase.channel('test');

channel.subscribe((status) => {
  console.log('Realtime status:', status);
  // "SUBSCRIBED" = connecté
  // "CLOSED" = déconnecté
  // "CHANNEL_ERROR" = erreur
});
```

### Logs

Dans Supabase Dashboard > Logs > Realtime

Voir toutes les connexions et messages en temps réel.

## 📊 Limites et Quotas

### Plan Gratuit Supabase

- **2 millions** de changements/mois
- **200 connexions** simultanées
- **10 messages/seconde** par client

### Optimisations

- Utiliser filtres stricts
- Regrouper listeners quand possible
- Désactiver Realtime sur pages non critiques

## ✅ Checklist Activation

- [ ] Realtime activé sur tables dans Supabase Dashboard
- [ ] Client Supabase configuré avec realtime params
- [ ] Listeners implémentés avec cleanup
- [ ] Filtres optimisés (pas de `event: '*'` partout)
- [ ] Notifications toast pour changements importants
- [ ] Tests en multi-onglets
- [ ] Monitoring logs Supabase

## 🚀 Déploiement

Realtime fonctionne automatiquement une fois :
1. ✅ Tables activées dans Supabase
2. ✅ Code frontend déployé
3. ✅ Variables d'env configurées

**Aucune configuration serveur supplémentaire nécessaire !**
