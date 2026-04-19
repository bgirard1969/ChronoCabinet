# Chrono DMI v2 — Analyse et Plan de Refonte

## 1. Analyse de l'existant vs Nouvelles exigences

### 1.1 Correspondance des entités (Actuel → Cible)

| Entité actuelle (MongoDB) | Entité cible | Action requise |
|---|---|---|
| `locations` (code, armoire, rangee, colonne, qr_code, occupied, batch_id, allowed_product_type) | `Cabinet` + `CabinetLocation` | **Scinder** en 2 entités. `Cabinet` = metadata (description, nb colonnes, nb rangées). `CabinetLocation` = emplacement individuel (rangée, colonne, product_id, isEmpty) |
| `fabricants` (nom uniquement) | `Supplier` (nom, personne_resource, tel, courriel) | **Enrichir** avec champs contact |
| `types_produit` (nom) | `ProductCategory` + `ProductType` + `ProductSpecification` | **Scinder** en 3 entités distinctes (spécification progressive) |
| `products` (nom, type, fabricant, reference, numero_grm, stock_min/max) | `Product` (supplier_id, type_id, category_id, specification_id, description, quantite_stock) | **Restructurer** — passer aux FK au lieu de strings, ajouter `specification_id` |
| `batches` (product_id, numero_lot, numero_serie, date_expiration, localisation, statut textuel) | `ProductInstance` (product_id, cabinet_location_id, serial, lot, expiry, usage_date, reception_date, status enum) | **Renommer + restructurer** — statut devient enum numérique, localisation devient FK vers CabinetLocation |
| `purchase_orders` + `purchase_order_items` | `Order` (creation_date, supplier_id, order_date nullable, grm_number nullable) + ProductInstances liées | **Restructurer** — les items de commande deviennent des `ProductInstance` avec status=ORDERED |
| `movements` (batch_id, type, quantite, user_id, raison, timestamp) | `Movement` (audit log avec detail, serial_number, lot_number) | **Conserver** comme journal d'audit, renommer `raison` → `detail` |
| `surgical_requests` (request_number, date_time, surgeon, operating_room, required_batches) | `Intervention` + `InterventionProduct` | **Restructurer** — retrait chirurgien/salle, ajout MRN + date naissance, spécification progressive |
| `users` (email, nom, prenom, role, pin, card_id) | `Employee` (mêmes champs + NIP) | **Enrichir** |
| _(n'existe pas)_ | `ProductStatus` (enum 1-6) | **Créer** |
| _(n'existe pas)_ | `ProductSpecification` | **Créer** — niveau de spécification supplémentaire |

### 1.2 Statut d'implémentation (Mise à jour avril 2026)

#### Implémenté et fonctionnel
- Authentification JWT (email/mot de passe + NIP tactile + carte employé)
- Dual client : Client Lourd (admin) + Client Léger (tactile)
- Socket.IO temps réel (événements `intervention_changed`, `inventory_changed`)
- CRUD complet : Products, Suppliers, Categories, Types, Specifications, Employees
- Cabinets avec matrice N×M, badges expiration, barres de remplissage
- Workflow de commande (création → envoi → réception)
- Workflow de picking FIFO (Picking classique + Picking Libre)
- Mise en stock unifiée (réapprovisionnement + remise en stock)
- Spécification progressive des interventions (ajout à n'importe quel niveau : Catégorie → Type → Spécification → Produit)
- MRN (identifiant patient) + Date de naissance sur toutes les interfaces
- Import Excel de consommation journalière (matching MRN/Description/SN/Lot)
- Export PDF et Excel des mouvements (avec filtres actifs)
- Filtres avancés avec calendrier de plage de dates (Interventions, Mouvements)
- Tri des colonnes (Mouvements, Commandes, Interventions)
- Export GRM (fichier pipe-delimited, fuseau America/Toronto)
- Composants partagés refactorisés (filtres en cascade, table stock, formulaire intervention)

#### Champs retirés de l'application (NE PAS réintroduire)
- `surgeon` / `chirurgien` — retiré de l'UI, des payloads et des formulaires
- `operating_room` / `salle` — retiré de l'UI, des payloads et des formulaires

#### À implémenter (Phase 5)
- Intégration armoires physiques (verrous, LED, détecteurs de présence)

---

## 2. Nouveau modèle de données

### 2.1 Schéma des collections MongoDB (Implémenté)

```
┌─────────────────────────────────────────────────────────────────┐
│                        RÉFÉRENTIEL                               │
├─────────────────────────────────────────────────────────────────┤
│ suppliers             │ product_categories  │ product_types       │
│ ─ id (uuid)           │ ─ id (uuid)         │ ─ id (uuid)         │
│ ─ name (50 max)       │ ─ description (50)  │ ─ description (50)  │
│ ─ contact_name?       │                     │                     │
│ ─ contact_phone?      │                     │                     │
│ ─ contact_email?      │                     │                     │
├───────────────────────┴─────────────────────┴─────────────────────┤
│ product_specifications                                           │
│ ─ id (uuid)                                                      │
│ ─ description (50)                                               │
├─────────────────────────────────────────────────────────────────┤
│                         CABINETS                                  │
├─────────────────────────────────────────────────────────────────┤
│ cabinets                        │ cabinet_locations               │
│ ─ id (uuid)                     │ ─ id (uuid)                     │
│ ─ description (50 max)          │ ─ cabinet_id (FK → cabinets)    │
│ ─ columns (int)                 │ ─ product_id? (FK → products)   │
│ ─ rows (int)                    │ ─ row (int)                     │
│                                 │ ─ column (int)                  │
│                                 │ ─ is_empty (bool, default true) │
│                                 │ ─ instance_id? (FK → instances) │
├─────────────────────────────────┴─────────────────────────────────┤
│                         PRODUITS                                  │
├─────────────────────────────────────────────────────────────────┤
│ products                                                         │
│ ─ id (uuid)                                                      │
│ ─ supplier_id (FK → suppliers)                                   │
│ ─ type_id (FK → product_types)                                   │
│ ─ category_id (FK → product_categories)                          │
│ ─ specification_id? (FK → product_specifications)                │
│ ─ description (80 max)                                           │
│ ─ grm_number? (N° GRM)                                          │
│ ─ quantity_in_stock (int, calculé)                                │
├─────────────────────────────────────────────────────────────────┤
│ product_instances                                                │
│ ─ id (uuid)                                                      │
│ ─ product_id (FK → products)                                     │
│ ─ cabinet_location_id? (FK → cabinet_locations)                  │
│ ─ serial_number? (255 max, unique si présent)                    │
│ ─ lot_number?                                                    │
│ ─ expiration_date?                                               │
│ ─ usage_date?                                                    │
│ ─ reception_date?                                                │
│ ─ status (int: 1=ORDERED, 2=RECEIVED, 3=PLACED,                 │
│           4=PICKED, 5=CONSUMED, 6=INVOICED)                      │
│ ─ order_id? (FK → orders)                                        │
├─────────────────────────────────────────────────────────────────┤
│                       COMMANDES                                   │
├─────────────────────────────────────────────────────────────────┤
│ orders                                                           │
│ ─ id (uuid)                                                      │
│ ─ supplier_id (FK → suppliers)                                   │
│ ─ creation_date (datetime)                                       │
│ ─ order_date? (datetime, nullable = non envoyée)                 │
│ ─ grm_number? (string, nullable)                                 │
│ ─ status (draft | sent | partially_received | received | closed) │
├─────────────────────────────────────────────────────────────────┤
│                     INTERVENTIONS                                 │
├─────────────────────────────────────────────────────────────────┤
│ interventions                    │ intervention_products           │
│ ─ id (uuid)                      │ ─ id (uuid)                     │
│ ─ planned_datetime               │ ─ intervention_id (FK)          │
│ ─ patient_file_number (MRN)      │ ─ product_id? (FK → products)   │
│ ─ birth_date? (AAAA-MM-JJ)      │ ─ category_id? (FK)             │
│ ─ status (planned|in_progress    │ ─ type_id? (FK)                 │
│          |completed|cancelled)   │ ─ specification_id? (FK)        │
│                                  │ ─ instance_id? (FK)             │
│                                  │ ─ serial_number?                │
│                                  │ ─ required_quantity (int)        │
│                                  │ ─ picked_quantity (int, def 0)   │
├──────────────────────────────────┴─────────────────────────────────┤
│                    SYSTÈME                                        │
├─────────────────────────────────────────────────────────────────┤
│ employees (ex-users)             │ movements (journal d'audit)    │
│ ─ id (uuid)                      │ ─ id (uuid)                     │
│ ─ email                          │ ─ instance_id? (FK)             │
│ ─ first_name, last_name          │ ─ product_id? (FK)              │
│ ─ role (enum)                    │ ─ type (string)                 │
│ ─ pin_hash?                      │ ─ quantity (int)                │
│ ─ card_id?                       │ ─ user_id                       │
│ ─ password_hash                  │ ─ reason? (detail)              │
│                                  │ ─ location_code?                │
│                                  │ ─ intervention_id?              │
│                                  │ ─ order_id?                     │
│                                  │ ─ timestamp                     │
└──────────────────────────────────┴─────────────────────────────────┘
```

### 2.2 ProductStatus — Cycle de vie

```
ORDERED (1) → RECEIVED (2) → PLACED (3) → PICKED (4) → CONSUMED (5) → INVOICED (6)
     │              │              │             │             │
     │              │              │             │             └─ Fin de vie: produit facturé
     │              │              │             └─ Produit prélevé pour intervention
     │              │              │                (peut revenir à PLACED si non utilisé)
     │              │              └─ Produit physiquement dans un cabinet
     │              └─ Produit réceptionné, données d'instance renseignées
     └─ Produit commandé, pas encore de n° série / lot / expiration
```

### 2.3 Spécification progressive des produits d'intervention

Un `InterventionProduct` peut être spécifié à n'importe quel niveau de granularité :

```
Catégorie (le plus large)
  └→ Type (Modèle)
       └→ Spécification
            └→ Produit exact (le plus précis)
                 └→ Instance (N° série assigné au picking)
```

L'interface permet de « compléter » progressivement un produit partiellement spécifié.

---

## 3. Architecture des deux interfaces client

### 3.1 Client Léger (Production — Écran tactile)

**Accès** : NIP (numpad tactile) ou scan carte employé + bouton urgence
**Utilisateurs** : Cliniciens, Gestionnaires, Admins

**Pages implémentées :**
1. `/light/login` — Numpad NIP + scan carte + bouton urgence
2. `/light/interventions` — Liste des interventions par date (navigation ← Aujourd'hui →)
   - Création d'intervention (MRN, Date naissance, produits avec filtres en cascade)
   - Modification d'intervention (édition en place, ajout/retrait produits)
   - Suppression d'intervention
3. `/light/picking/:id` — Prélèvement FIFO pour une intervention
   - Cartes produit avec localisation cabinet en grand
   - Sous-lignes par instance (SN, Exp, localisation) avec bouton "Prélever"
   - Bouton refresh pour nouvelles suggestions FIFO
   - Édition en place (modal de modification)
   - Ajout dynamique de produits avec filtres en cascade
4. `/light/picking-libre` — Picking Libre (hors intervention)
   - Filtres cascadés Catégorie → Modèle → Spécification
   - Scan direct N° de série
   - Validation MRN
5. `/light/restock` — Mise en stock unifiée (réapprovisionnement + remise en stock)

**Fonctionnalités gestionnaire** (visible si rôle gestionnaire/admin) :
- 3 boutons d'action : Mise en stock | PICKING | + Intervention

### 3.2 Client Lourd (Administration — Plein écran)

**Accès** : Email + mot de passe
**Utilisateurs** : Gestionnaires, Administrateurs

**Pages implémentées :**
1. `/admin/interventions` — Tableau filtrable (Aujourd'hui / Cette semaine / Toutes / Période personnalisée)
   - Colonnes : Date/Heure, MRN, Date naissance, Produits, Statut
   - Calendrier de plage de dates (popover avec 2 mois, locale fr)
   - Création avec formulaire + filtres en cascade + table stock
   - Panneau détail avec produits, spécification progressive (Compléter/Affiner)
   - Modification (MRN, date naissance, date/heure)
   - Suppression avec confirmation
2. `/admin/cabinets` — Liste cabinets + matrice N×M interactive
   - Badges d'expiration, tooltips, barres de remplissage
3. `/admin/products` — 5 onglets : Produits, Fournisseurs, Catégories, Modèles, Spécifications
   - CRUD complet pour chaque onglet
   - Formulaire produit : Description → Catégorie → Modèle → Spécification → GRM → Fournisseur
4. `/admin/orders` — Commandes d'achat
   - Tri par colonne (date d'envoi descendant par défaut)
   - Workflow : création → envoi → réception
5. `/admin/consumption` — Import de consommation Excel
   - Upload fichier Excel (.xlsx)
   - Matching automatique MRN/Description/SN/Lot
   - Panneau de prévisualisation : Trouvé / Non trouvé / À vérifier
6. `/admin/employees` — Gestion employés (CRUD + rôles + NIP + carte)
7. `/admin/movements` — Journal des mouvements
   - Filtres : Recherche texte, N° Série, N° Lot, Plage de dates (calendrier popover)
   - Tri par colonne
   - Export Excel et PDF (respectant les filtres actifs)

### 3.3 Composants partagés (Refactorisés)

```
frontend/src/components/interventions/
├── index.js                    # Barrel export
├── useStockBrowser.js          # Hook: état stock + filtres cascadés
├── interventionHelpers.js      # getPartialLabel, getResolutionBadge, statusColors, statusLabels
├── CascadingFilters.jsx        # 3 colonnes Catégorie / Modèle / Spécification (light/dark)
├── StockResultsTable.jsx       # Table résultats produits avec actions (light/dark)
└── InterventionFormFields.jsx  # Champs formulaire: datetime, MRN, date naissance (light/dark)
```

---

## 4. Plan d'implémentation — Statut

| # | Phase | Effort | Statut |
|---|---|---|---|
| 1 | Nouveau modèle de données + migration | Élevé | **TERMINÉ** |
| 2 | Workflows métier backend | Élevé | **TERMINÉ** |
| 3 | Client Lourd (admin) | Élevé | **TERMINÉ** |
| 4 | Client Léger (tactile) | Moyen | **TERMINÉ** |
| 5 | Stubs hardware + Socket.IO | Faible | **Socket.IO terminé** / Hardware P2 |

---

## 5. Document d'architecture pour migration Angular/NestJS/MSSQL

### 5.1 Stack cible

| Composant | Technologie | Justification |
|---|---|---|
| Client Lourd | Angular 17+ + PrimeNG | Rich desktop-like UI, PrimeNG pour tables/filtres avancés |
| Client Léger | Angular 17+ + PrimeNG | Même framework, composants tactiles personnalisés |
| Serveur | NestJS + TypeORM | Architecture modulaire, injection de dépendances, DTOs |
| Base de données | MSSQL (SQL Server) | Intégrité référentielle native, transactions ACID |
| Temps réel | Socket.IO (via @nestjs/websockets) | Événements hardware, mises à jour en temps réel |

### 5.2 Structure NestJS recommandée

```
src/
├── app.module.ts
├── main.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/          # JWT, PIN, Card
│   └── guards/              # RolesGuard, AuthGuard
├── cabinets/
│   ├── cabinets.module.ts
│   ├── cabinets.controller.ts
│   ├── cabinets.service.ts
│   └── entities/
│       ├── cabinet.entity.ts
│       └── cabinet-location.entity.ts
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   └── entities/
│       ├── product.entity.ts
│       ├── product-instance.entity.ts
│       ├── product-category.entity.ts
│       ├── product-type.entity.ts
│       ├── product-specification.entity.ts
│       └── product-status.enum.ts
├── suppliers/
│   ├── suppliers.module.ts
│   ├── suppliers.controller.ts
│   ├── suppliers.service.ts
│   └── entities/supplier.entity.ts
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── entities/order.entity.ts
├── interventions/
│   ├── interventions.module.ts
│   ├── interventions.controller.ts
│   ├── interventions.service.ts
│   └── entities/
│       ├── intervention.entity.ts          # MRN + birth_date, sans surgeon/salle
│       └── intervention-product.entity.ts  # Spécification progressive
├── consumption/
│   ├── consumption.module.ts
│   ├── consumption.controller.ts
│   └── consumption.service.ts
├── employees/
│   ├── employees.module.ts
│   ├── employees.controller.ts
│   ├── employees.service.ts
│   └── entities/employee.entity.ts
├── movements/
│   ├── movements.module.ts
│   ├── movements.controller.ts
│   ├── movements.service.ts
│   └── entities/movement.entity.ts
├── hardware/
│   ├── hardware.module.ts
│   ├── hardware.gateway.ts      # Socket.IO gateway
│   ├── hardware.service.ts
│   └── interfaces/hardware-event.interface.ts
└── common/
    ├── decorators/roles.decorator.ts
    ├── filters/http-exception.filter.ts
    └── interceptors/transform.interceptor.ts
```

### 5.3 Points d'attention pour la migration

- **MRN** remplace `patient_file_number` dans l'UI (le champ DB reste `patient_file_number`)
- **birth_date** est un nouveau champ string (format AAAA-MM-JJ)
- **surgeon** et **operating_room** sont retirés de `Intervention`
- **InterventionProduct** supporte la spécification progressive : `category_id`, `type_id`, `specification_id`, `product_id` sont tous optionnels
- **Mouvements** : `reason` affiché comme "Détail" dans l'UI, avec champs supplémentaires `serial_number`, `lot_number` pour filtrage
- **Consommation** : nouveau module pour import Excel quotidien

### 5.4 Socket.IO — Événements implémentés

| Événement | Direction | Payload | Usage |
|---|---|---|---|
| `intervention_changed` | Serveur → Client | `{ interventionId }` | MAJ liste interventions |
| `inventory_changed` | Serveur → Client | `{ type, instanceId? }` | MAJ stock temps réel |
| `cabinet:unlock` | Client → Serveur | `{ cabinetId }` | Déverrouiller armoire (Phase 5) |
| `cabinet:lock` | Client → Serveur | `{ cabinetId }` | Verrouiller armoire (Phase 5) |
| `location:led` | Client → Serveur | `{ locationId, color, on }` | Contrôle LED (Phase 5) |
| `location:presence` | Serveur → Client | `{ locationId, hasProduct }` | Détecteur présence (Phase 5) |

---

## 6. Résumé des priorités

| # | Phase | Effort | Priorité | Statut |
|---|---|---|---|---|
| 1 | Nouveau modèle de données + migration | Élevé | P0 | **Terminé** |
| 2 | Workflows métier backend | Élevé | P0 | **Terminé** |
| 3 | Client Lourd (admin) | Élevé | P1 | **Terminé** |
| 4 | Client Léger (tactile) | Moyen | P1 | **Terminé** |
| 5 | Intégration armoires physiques | Faible | P2 | En attente |
| 6 | Migration Angular/NestJS/MSSQL | Moyen | P3 | Documentation prête |

---

*Document mis à jour le 13 avril 2026 — Chrono DMI v2*
