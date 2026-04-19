# Chrono DMI v2 — Spécifications Fonctionnelles Complètes

*Document généré le 13 avril 2026*
*Version: 2.0*

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles et permissions](#2-rôles-et-permissions)
3. [Authentification](#3-authentification)
4. [Client Lourd — Pages Admin](#4-client-lourd--pages-admin)
5. [Client Léger — Pages Production](#5-client-léger--pages-production)
6. [API Backend — Endpoints complets](#6-api-backend--endpoints-complets)
7. [Événements Socket.IO](#7-événements-socketio)
8. [Modèle de données](#8-modèle-de-données)
9. [Cycle de vie ProductStatus](#9-cycle-de-vie-productstatus)
10. [Règles métier](#10-règles-métier)

---

## 1. Vue d'ensemble

### 1.1 Description
Chrono DMI v2 est un système de traçabilité de dispositifs médicaux implantables (DMI) pour milieu hospitalier. L'application permet de gérer le cycle de vie complet des produits : commande, réception, placement en cabinet, prélèvement FIFO pour interventions chirurgicales, consommation et facturation.

### 1.2 Architecture bi-client
L'application offre deux interfaces distinctes dans une même application React :

| Client | URL racine | Thème | Accès | Utilisateurs |
|--------|-----------|-------|-------|-------------|
| **Client Lourd** (Admin) | `/admin/*` | Clair (blanc) | Email + mot de passe | Gestionnaires, Administrateurs |
| **Client Léger** (Production) | `/light/*` | Sombre (slate-900) | NIP / Carte employé | Cliniciens, Gestionnaires, Admins |

### 1.3 Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | React 18, Tailwind CSS, shadcn/ui, Lucide React, react-day-picker, date-fns |
| Backend | FastAPI, Motor (MongoDB async), Pydantic |
| Base de données | MongoDB |
| Temps réel | Socket.IO (python-socketio + socket.io-client) |
| Auth | JWT + bcrypt |
| Exports | openpyxl (Excel), reportlab (PDF), xlsxwriter (Excel export) |
| Fuseau horaire | America/Toronto (Eastern Time) |

---

## 2. Rôles et permissions

### 2.1 Définition des rôles

| Rôle | ID | Client Lourd | Client Léger | Description |
|------|-----|-------------|-------------|-------------|
| Administrateur | `administrateur` | Accès complet | Accès complet + gestion | Accès total à toutes les fonctionnalités |
| Gestionnaire | `gestionnaire` | Accès complet | Accès complet + gestion | Gestion des stocks, commandes, réception |
| Technicien | `technicien` | Non | Picking + Mise en stock | Opérations de stock |
| Clinicien | `clinicien` | Non | Interventions + Picking | Prélèvement de produits uniquement |
| Lecture | `lecture` | Consultation seule | Non | Consultation uniquement |

### 2.2 Matrice d'accès Client Lourd

| Page | Administrateur | Gestionnaire | Lecture |
|------|---------------|-------------|---------|
| Interventions | CRUD complet | CRUD complet | Lecture |
| Cabinets | CRUD complet | CRUD complet | Lecture |
| Produits (5 onglets) | CRUD complet | CRUD complet | Lecture |
| Commandes | CRUD complet | CRUD complet | Lecture |
| Consommation | Import + validation | Import + validation | Lecture |
| Employés | CRUD complet | Non | Non |
| Mouvements | Lecture + export | Lecture + export | Lecture |

### 2.3 Matrice d'accès Client Léger

| Fonctionnalité | Administrateur | Gestionnaire | Technicien | Clinicien |
|---------------|---------------|-------------|-----------|----------|
| Voir interventions du jour | Oui | Oui | Non | Oui |
| Picking (par intervention) | Oui | Oui | Oui | Oui |
| Picking Libre | Oui | Oui | Oui | Non |
| Mise en stock | Oui | Oui | Oui | Non |
| Créer/modifier intervention | Oui | Oui | Non | Non |
| Supprimer intervention | Oui | Oui | Non | Non |

---

## 3. Authentification

### 3.1 Méthodes d'authentification

#### 3.1.1 Email + Mot de passe (Client Lourd)
- **Page** : `/` (page racine)
- **Formulaire** : Email, Mot de passe, bouton "Se connecter"
- **API** : `POST /api/auth/login`
- **Payload** : `{ email, password }`
- **Réponse** : `{ access_token, token_type, user }`
- **Token** : JWT, expire après 480 min (8h — quart hospitalier)

#### 3.1.2 NIP (Client Léger)
- **Page** : `/light/login`
- **Interface** : Numpad tactile (boutons 0-9, C pour effacer, ← pour backspace)
- **API** : `POST /api/auth/login-pin`
- **Payload** : `{ pin }`
- **Logique** : Itère sur tous les employés avec `pin_hash`, vérifie avec bcrypt

#### 3.1.3 Carte employé (Client Léger)
- **Page** : `/light/login` (onglet "Carte")
- **Interface** : Champ de scan pour ID carte
- **API** : `POST /api/auth/login-card`
- **Payload** : `{ card_id }`
- **Logique** : Recherche directe par `card_id`

#### 3.1.4 Urgence (Client Léger)
- **Page** : `/light/login`
- **Bouton** : "URGENCE" (rouge, en bas du numpad)
- **Comportement** : Connexion rapide sans authentification complète

### 3.2 Gestion du token
- Stockage : `localStorage` (`token`, `clientMode`)
- Intercepteur Axios : Ajoute `Authorization: Bearer {token}` à chaque requête
- Vérification : `GET /api/auth/me` — retourne l'employé courant
- Expiration : 401 → suppression du token → redirection login

### 3.3 Inscription
- **API** : `POST /api/auth/register`
- **Payload** : `{ email, password, first_name, last_name, role, pin?, card_id? }`
- **Validations** : Email unique, card_id unique

---

## 4. Client Lourd — Pages Admin

### 4.1 Page de connexion (`/`)

**Composant** : `Login.js`

**Éléments UI** :
- Logo "Chrono DMI" + sous-titre
- Formulaire email/mot de passe avec toggle visibilité
- Bouton "Se connecter"
- Lien vers Client Léger (`/light/login`)

**Comportement** :
- Succès → `localStorage.setItem('clientMode', 'admin')` → redirect `/admin/interventions`
- Échec → toast d'erreur

---

### 4.2 Layout Admin (`/admin/*`)

**Composant** : `AdminLayout.js`

**Sidebar de navigation** :
| Icône | Label | Route | 
|-------|-------|-------|
| Calendar | Interventions | `/admin/interventions` |
| Box | Cabinets | `/admin/cabinets` |
| Package | Produits | `/admin/products` |
| ShoppingCart | Commandes | `/admin/orders` |
| ClipboardCheck | Consommation | `/admin/consumption` |
| Users | Employés | `/admin/employees` |
| Activity | Mouvements | `/admin/movements` |

**Footer sidebar** : Initiales de l'utilisateur, nom, rôle, bouton "Déconnexion"

---

### 4.3 Interventions (`/admin/interventions`)

**Composant** : `pages/admin/Interventions.js`
**Composants partagés** : `useStockBrowser`, `CascadingFilters`, `StockResultsTable`, `InterventionFormFields`

#### 4.3.1 Filtres

| Filtre | Type | Comportement |
|--------|------|-------------|
| Aujourd'hui | Bouton toggle | Filtre `filter=today` |
| Cette semaine | Bouton toggle | Filtre `filter=week` |
| Toutes | Bouton toggle | Filtre `filter=all` |
| Période | Popover calendrier | Sélection plage de dates (`date_from`, `date_to`) |

**Calendrier plage de dates** :
- Composant : shadcn `Calendar` dans `Popover`
- Mode : `range` (sélection début → fin)
- Affichage : 2 mois côte à côte
- Locale : `fr` (date-fns)
- Fermeture auto : quand `from` ET `to` sont sélectionnés
- Bouton X pour réinitialiser

#### 4.3.2 Tableau des interventions

| Colonne | Contenu |
|---------|---------|
| Date/Heure | Icône calendrier + date + icône horloge + heure (format `fr-CA`) |
| MRN | `patient_file_number` ou "—" |
| Date naissance | `birth_date` ou "—" |
| Produits | Badge "{N} produit(s)" ou "—" |
| Statut | Badge coloré (Planifiée / En cours / Terminée / Annulée) |

**Clic sur une ligne** → ouvre le panneau détail.

#### 4.3.3 Modal création ("Nouvelle intervention")

**Champs du formulaire** (`InterventionFormFields`) :
| Champ | Type | Requis | TestID |
|-------|------|--------|--------|
| Date et heure | `datetime-local` | Oui | `create-datetime` |
| MRN | `text` | Non | `create-patient` |
| Date naissance | `date` | Non | `create-birthdate` |

**Section produits requis** :
1. **Filtres en cascade** (`CascadingFilters`) : 3 colonnes
   - Catégorie → filtre les Modèles disponibles
   - Modèle → filtre les Spécifications disponibles
   - Spécification → filtre les Produits
2. **Bouton "Ajouter : {label}"** : Ajoute au niveau du filtre sélectionné (spécification progressive)
3. **Table résultats** (`StockResultsTable`) : Description, N° série, Stock, bouton "+"
4. **Produits sélectionnés** : Chips avec badge de résolution, quantité ± , bouton supprimer

**API appelée** : `POST /api/interventions`
**Payload** :
```json
{
  "planned_datetime": "2026-04-13T09:00:00",
  "patient_file_number": "12345678",
  "birth_date": "1990-05-15",
  "products": [
    {"product_id": "uuid", "required_quantity": 2},
    {"category_id": "uuid", "type_id": "uuid", "required_quantity": 1}
  ]
}
```

#### 4.3.4 Panneau détail

**En-tête** :
- Date/heure + MRN + Date naissance
- Boutons : Modifier (crayon), Supprimer (poubelle), Fermer (X)

**Liste des produits** :
- Badge de résolution : Instance / Produit / Spécification / Modèle / Catégorie
- Label du produit (description enrichie)
- N° série (si assigné)
- Alerte "À compléter" pour les produits partiellement spécifiés
- Bouton "Compléter" → active le mode raffinage
- Contrôles quantité (- / + / supprimer)
- Compteur "prélevé(s)"

**Section ajouter/compléter** :
- Même `CascadingFilters` + `StockResultsTable`
- En mode "compléter" : bouton check au lieu de "+"
- Bouton "Confirmer : {label}" pour confirmer le raffinage

**APIs appelées** :
- `GET /api/interventions/{id}` — Détail
- `POST /api/interventions/{id}/products` — Ajouter produit
- `PUT /api/interventions/{id}/products/{ip_id}` — Raffiner/modifier
- `DELETE /api/interventions/{id}/products/{ip_id}` — Retirer produit

#### 4.3.5 Modal modification

**Champs** : Même `InterventionFormFields` (datetime, MRN, birth_date) pré-rempli
**API** : `PUT /api/interventions/{id}`

#### 4.3.6 Dialog suppression

**Contenu** : "Supprimer l'intervention ? Cette action est irréversible. Tous les produits associés seront également supprimés."
**API** : `DELETE /api/interventions/{id}`

#### 4.3.7 Temps réel
- `useSocketEvent(['intervention_changed', 'inventory_changed'])` → `fetchData()`

---

### 4.4 Cabinets (`/admin/cabinets`)

**Composant** : `pages/admin/Cabinets.js`

#### 4.4.1 Liste des cabinets
- Tableau : Description, Dimensions (R×C), Emplacements occupés/total
- Bouton "Nouveau cabinet"
- Clic → vue matrice

#### 4.4.2 Formulaire création cabinet
| Champ | Type |
|-------|------|
| Description | `text` |
| Lignes (rows) | `number` |
| Colonnes (columns) | `number` |

**API** : `POST /api/cabinets`
→ Auto-génère toutes les `CabinetLocation` (N×M)

#### 4.4.3 Vue matrice N×M
- Grille interactive avec chaque cellule représentant un emplacement
- **Couleurs** :
  - Vide (pas de produit) : gris
  - Vide (produit désigné mais absent) : bleu clair
  - Occupé : vert / jaune / rouge selon expiration
- **Badges expiration** : Nombre de jours avant expiration
- **Tooltips** : Description produit, N° série, date expiration
- **Barres de remplissage** par cabinet
- Clic sur cellule → associer/désassocier un produit

**APIs** :
- `GET /api/cabinets/{id}/locations` — Matrice enrichie
- `PUT /api/cabinets/{id}/locations/{loc_id}` — Associer produit
- `PUT /api/cabinets/{id}` — Modifier cabinet
- `DELETE /api/cabinets/{id}` — Supprimer (si vide)

---

### 4.5 Produits (`/admin/products`)

**Composant** : `pages/admin/Products.js`

#### 4.5.1 Navigation par onglets (5 onglets)

| Onglet | Collection MongoDB | CRUD |
|--------|-------------------|------|
| Produits | `products` | Oui |
| Fournisseurs | `suppliers` | Oui |
| Catégories | `product_categories` | Oui |
| Modèles | `product_types` | Oui |
| Spécifications | `product_specifications` | Oui |

#### 4.5.2 Onglet Produits

**Tableau** : Description, Catégorie, Modèle, Spécification, GRM, Fournisseur, Stock

**Formulaire produit (ordre)** :
| Champ | Type | Requis | Source |
|-------|------|--------|--------|
| Description | `text` (80 max) | Oui | Saisie libre |
| Catégorie | `select` | Oui | `GET /api/product-categories` |
| Modèle | `select` | Oui | `GET /api/product-types` |
| Spécification | `select` | Non | `GET /api/product-specifications` |
| N° GRM | `text` | Non | Saisie libre |
| Fournisseur | `select` | Oui | `GET /api/suppliers` |

**APIs** :
- `GET /api/products` — Liste enrichie (supplier, category, type, specification_obj, quantity_in_stock)
- `GET /api/products/{id}` — Détail
- `GET /api/products/{id}/instances` — Instances avec localisation
- `POST /api/products` — Créer (valide les FK)
- `PUT /api/products/{id}` — Modifier
- `DELETE /api/products/{id}` — Supprimer (si aucune instance)

#### 4.5.3 Onglet Fournisseurs

| Champ | Type |
|-------|------|
| Nom | `text` (50 max) |
| Contact | `text` |
| Téléphone | `text` |
| Email | `email` |

**APIs** : `GET/POST/PUT/DELETE /api/suppliers[/{id}]`

#### 4.5.4 Onglets Catégories / Modèles / Spécifications
- Champ unique : `description` (50 max)
- Protection : suppression impossible si utilisé par un produit

**APIs** :
- Catégories : `GET/POST/PUT/DELETE /api/product-categories[/{id}]`
- Modèles : `GET/POST/PUT/DELETE /api/product-types[/{id}]`
- Spécifications : `GET/POST/PUT/DELETE /api/product-specifications[/{id}]`

#### 4.5.5 Endpoint filter-options (cascade)

`GET /api/products/filter-options?category_id=&type_id=&specification_id=`

Retourne :
```json
{
  "filter_options": {
    "categories": [...],
    "types": [...],
    "specifications": [...]
  },
  "products": [
    {
      "product_id": "uuid",
      "description": "...",
      "category": {...},
      "type": {...},
      "specification": {...},
      "quantity": 5,
      "instances": [{"id": "...", "serial_number": "...", "lot_number": "...", "expiration_date": "..."}]
    }
  ]
}
```

---

### 4.6 Commandes (`/admin/orders`)

**Composant** : `pages/admin/Orders.js`

#### 4.6.1 Tableau des commandes
- **Tri par défaut** : Date d'envoi descendant
- **Tri cliquable** sur chaque colonne (toggle asc/desc)
- Colonnes : Fournisseur, N° GRM, Statut, Date création, Date envoi, Items (reçus/total)

#### 4.6.2 Statuts de commande

| Statut | Label | Couleur |
|--------|-------|---------|
| `draft` | Brouillon | Gris |
| `sent` | Envoyée | Bleu |
| `partially_received` | Partiellement reçue | Jaune |
| `received` | Reçue | Vert |
| `closed` | Fermée | Slate |
| `cancelled` | Annulée | Rouge |

#### 4.6.3 Workflow commande

```
1. Créer (POST /api/orders)
   → Sélection fournisseur, ajout produits+quantités
   → Crée des ProductInstances status=ORDERED

2. Envoyer (PUT /api/orders/{id}/send)
   → Set order_date, status="sent"
   → Verrouille les modifications

3. Réceptionner (PUT /api/orders/{id}/receive)
   → Pour chaque item : assigner serial_number (requis), lot_number, expiration_date (requis)
   → Status ORDERED → RECEIVED
   → Validation : N° série unique en base, pas de doublon dans le batch

4. Ajouter items (POST /api/orders/{id}/items) — draft uniquement

5. Annuler (DELETE /api/orders/{id}) — draft uniquement
   → Supprime les instances ORDERED
```

#### 4.6.4 Export GRM

`POST /api/instances/export-grm`

**Fonctionnement** :
1. Récupère toutes les instances CONSUMED
2. Génère un fichier texte pipe-delimited (format GRM)
3. Crée des commandes de remplacement par fournisseur (instances ORDERED)
4. Transition CONSUMED → INVOICED
5. Enregistre les mouvements de facturation

**Retour** :
```json
{
  "grm_content": "1|1.0|T008|RC|...",
  "grm_lines_count": 5,
  "invoiced_count": 5,
  "orders_created": [{"order_id": "...", "supplier_name": "...", "total_items": 3}]
}
```

---

### 4.7 Consommation (`/admin/consumption`)

**Composant** : `pages/admin/Consumption.js`

#### 4.7.1 Import Excel

**Étape 1 — Upload** :
- Zone de dépôt/sélection fichier `.xlsx`
- `POST /api/consumption/import/preview` (multipart/form-data)

**Parsing des colonnes** (flexible, par mot-clé dans l'en-tête) :

| Mot-clé recherché | Champ mappé |
|-------------------|-------------|
| `mrn` | MRN patient |
| `naissance` | Date de naissance |
| `serie` / `série` | N° de série |
| `lot` + `no` | N° de lot |
| `description` + `produit` | Description produit |
| `date operation` | Date opération |
| `date expiration` | Date expiration |
| `code` + `article` | Code article |

**Étape 2 — Prévisualisation** :
- 3 panneaux de résultats :

| Panneau | Statut | Description |
|---------|--------|------------|
| Trouvé | `matched` | Correspondance exacte (SN/Lot/Description) |
| Non trouvé | `unmatched` | Aucune correspondance (SN ou Lot fourni mais non trouvé) |
| À vérifier | `manual` | Correspondance partielle (ni SN ni Lot fourni) |

**Matching par priorité** :
1. `serial_number` exact → instance PLACED ou PICKED
2. `lot_number` exact → instance PLACED ou PICKED
3. `description` (regex case-insensitive) → produit puis instance

**Étape 3 — Confirmation** :
- `POST /api/consumption/import/confirm`
- Pour chaque instance matchée :
  - PLACED → libère cabinet location → status CONSUMED
  - PICKED → status CONSUMED
- Enregistre les mouvements de prélèvement + consommation
- Sauvegarde historique dans `import_history`

#### 4.7.2 Historique des imports

`GET /api/consumption/imports`

Affiche : date, utilisateur, nombre de lignes, confirmés, ignorés, erreurs.

---

### 4.8 Employés (`/admin/employees`)

**Composant** : `pages/admin/Employees.js`

**Restriction d'accès** : Seuls les administrateurs peuvent créer/modifier/supprimer.

#### 4.8.1 Tableau
- Colonnes : Prénom, Nom, Email, Rôle, NIP (a/pas), Carte (a/pas)
- Auto-suppression interdite

#### 4.8.2 Formulaire employé

| Champ | Type | Requis |
|-------|------|--------|
| Prénom | `text` | Oui |
| Nom | `text` | Oui |
| Email | `email` (unique) | Oui |
| Mot de passe | `password` | Oui (création) |
| Rôle | `select` | Oui |
| NIP | `text` (4+ chiffres) | Non |
| ID Carte | `text` (unique) | Non |

**APIs** :
- `GET /api/employees` — Liste (sans password_hash/pin_hash)
- `GET /api/employees/roles` — Rôles disponibles
- `POST /api/employees` — Créer (admin only)
- `PUT /api/employees/{id}` — Modifier (admin only)
- `DELETE /api/employees/{id}` — Supprimer (admin only, pas soi-même)

---

### 4.9 Mouvements (`/admin/movements`)

**Composant** : `pages/admin/Movements.js`

#### 4.9.1 Filtres

| Filtre | Type | Position |
|--------|------|----------|
| Recherche texte | `input` | Barre supérieure |
| N° Série | `input` (icône scan) | Inline avec les boutons |
| N° Lot | `input` (icône scan) | Inline avec les boutons |
| Plage de dates | Popover calendrier | Barre supérieure |

**Calendrier plage** : Même composant que les interventions (Calendar + Popover, 2 mois, locale fr)

#### 4.9.2 Tableau des mouvements

| Colonne | Triable | Contenu |
|---------|---------|---------|
| Date/Heure | Oui | Timestamp converti en ET (America/Toronto) |
| Type | Oui | Badge coloré (Commandé, Réception, Placement, Prélèvement, Retour, Consommation, Facturation) |
| Produit | Oui | Description du produit |
| N° Série | Non | serial_number de l'instance |
| N° Lot | Non | lot_number de l'instance |
| Emplacement | Non | location_code (Cabinet-R-C) |
| Utilisateur | Non | Prénom Nom |
| Détail | Non | Raison du mouvement |

#### 4.9.3 Exports

**Export Excel** :
- `GET /api/movements/export/excel?date_from=&date_to=&type=&serial_number=&lot_number=`
- Format : `.xlsx` (xlsxwriter)
- Colonnes : Date/Heure, Type, Produit, N° Série, N° Lot, Emplacement, Utilisateur, Détail

**Export PDF** :
- `GET /api/movements/export/pdf?date_from=&date_to=&type=&serial_number=&lot_number=`
- Format : PDF paysage (reportlab)
- Titre dynamique avec période

**Règle** : Les deux exports respectent les filtres actifs côté client (passés en query params).

**API** : `GET /api/movements` — Tous les mouvements enrichis (produit, user_name, serial_number, lot_number)

---

## 5. Client Léger — Pages Production

### 5.1 Login (`/light/login`)

**Composant** : `pages/light/Login.js`

#### 5.1.1 Onglet NIP
- Numpad tactile (boutons 0-9, grands, espacement)
- Affichage masqué des chiffres saisis (●●●●)
- Bouton C (clear), ← (backspace)
- Bouton "Confirmer"
- API : `POST /api/auth/login-pin`

#### 5.1.2 Onglet Carte
- Champ de scan avec auto-focus
- API : `POST /api/auth/login-card`

#### 5.1.3 Bouton Urgence
- Grand bouton rouge "URGENCE" en bas
- Accès rapide sans auth standard

#### 5.1.4 Lien retour
- "← Client Lourd" → `/`

---

### 5.2 Interventions du jour (`/light/interventions`)

**Composant** : `pages/light/Interventions.js`
**Composants partagés** : `useStockBrowser`, `CascadingFilters`, `StockResultsTable`, `InterventionFormFields`

#### 5.2.1 Navigation par date
- Flèches ← / → pour jours précédent/suivant
- Label central : "Aujourd'hui", "Demain", "Hier", ou date complète
- Sélecteur de date (input caché derrière icône calendrier)
- API : `GET /api/interventions?date=YYYY-MM-DD`

#### 5.2.2 Boutons d'action (gestionnaire/admin uniquement)

| Bouton | Couleur | Action |
|--------|---------|--------|
| Mise en stock | Vert (emerald) | Navigate → `/light/restock` |
| PICKING | Bleu | Navigate → `/light/picking-libre` |
| + Intervention | Violet | Ouvre modal création |

#### 5.2.3 Liste des interventions
- Carte par intervention (thème sombre) :
  - Heure (badge bleu)
  - MRN + "Né(e): {birth_date}"
  - "{N} produit(s) requis"
  - Bouton → (navigate picking)
  - Bouton crayon (ouvre modal édition)

#### 5.2.4 Modal création/édition (combinée)

**Mode `create`** :
- Formulaire `InterventionFormFields` (dark)
- Section produits (même CascadingFilters + StockResultsTable en dark)
- Boutons Annuler / Créer

**Mode `edit`** :
- Formulaire pré-rempli
- Produits de l'intervention existante (avec badge résolution)
- Ajout/suppression de produits via API
- Boutons Supprimer / Annuler / Enregistrer

**Suppression** : Dialog de confirmation (dark, z-60)

#### 5.2.5 URL param `?edit=id`
- Si présent au chargement, ouvre automatiquement la modal d'édition pour cette intervention

#### 5.2.6 Temps réel
- `useSocketEvent(['intervention_changed', 'inventory_changed'])` → refresh

---

### 5.3 Picking FIFO (`/light/picking/:interventionId`)

**Composant** : `pages/light/Picking.js`

#### 5.3.1 En-tête intervention
- Date/heure, MRN, Date naissance
- Boutons : Éditer (→ retour /light/interventions?edit=id), Retour

#### 5.3.2 Suggestions FIFO

`GET /api/interventions/{id}/fifo-suggestions`

Pour chaque produit requis de l'intervention :
- Recherche les instances PLACED correspondantes (par product_id ou par category/type/spec matching)
- Tri FIFO : expiration la plus proche en premier
- Instances sans expiration : après celles avec expiration

**Affichage par produit requis** :
- **Gauche** : Description du produit, badge résolution (Catégorie/Modèle/Spec/Produit)
- **Droite** : Localisation cabinet en grand
- **Badge** : Quantité disponible (vert)
- **Sous-lignes** par instance : N° série, date expiration, localisation, bouton "Prélever"

#### 5.3.3 Prélèvement

`POST /api/interventions/{id}/pick`
**Payload** : `{ instance_id, product_id?, force? }`

**Validation de correspondance** :
- Vérifie que l'instance correspond à un `InterventionProduct` non complété
- Match exact par `product_id` ou match partiel par `category_id`/`type_id`/`specification_id`
- Si mismatch et `force=false` → retourne `{ mismatch: true, message, scanned_description, expected_label }`
- Si mismatch et `force=true` → prélève quand même
- Si match → prélève normalement

**Actions au prélèvement** :
1. Instance : status PLACED → PICKED
2. Cabinet location : `is_empty = true`
3. InterventionProduct : `picked_quantity += 1`
4. Movement créé (type="prelevement")
5. Socket.IO : `intervention_changed` + `inventory_changed`

#### 5.3.4 Boutons additionnels
- **Refresh** (cycle) : Recharge les suggestions FIFO
- **Crayon** : Modal de modification inline (MRN, date naissance, quantité)
- **+** : Ajout dynamique de produit avec filtres en cascade

---

### 5.4 Picking Libre (`/light/picking-libre`)

**Composant** : `pages/light/PickingLibre.js`

#### 5.4.1 Workflow
1. **Filtres cascadés** : Catégorie → Modèle → Spécification (API: `/api/instances/available-stock`)
2. **Sélection produit** dans les résultats
3. **Scan N° de série** (champ dédié) pour confirmer l'instance exacte
4. **Validation MRN** + Date naissance

#### 5.4.2 APIs
- `GET /api/instances/available-stock?category_id=&type_id=&specification_id=` — Stock disponible groupé par produit
- `POST /api/instances/pick-libre` — `{ instance_id, patient_file }`

**Actions** :
1. Instance PLACED → PICKED
2. Libère cabinet location
3. Movement créé (type="prelevement", reason="Prélèvement libre — MRN: {mrn}")

---

### 5.5 Mise en stock (`/light/restock`)

**Composant** : `pages/light/Restock.js`

#### 5.5.1 Flux unifié

**Étape 1 — Scan** :
- `POST /api/instances/scan` avec `{ serial_number }`
- Retourne l'action appropriée selon le statut :

| Statut instance | Action retournée | Comportement |
|----------------|-----------------|-------------|
| RECEIVED | `place` | Placement initial en cabinet |
| PICKED | `return_to_stock` | Remise en stock |
| PLACED | `already_placed` | Déjà en stock (affiche localisation) |
| CONSUMED/INVOICED | `unavailable` | Non disponible |
| Non trouvé | `unknown` | N° série inconnu |

**Étape 2 — Localisation** :
- Suggestion automatique d'emplacement :
  1. Priorité : emplacement désigné pour ce produit (et vide)
  2. Fallback : n'importe quel emplacement vide non désigné

**Étape 3 — Confirmation** :
- `POST /api/instances/place` pour RECEIVED → PLACED
- `POST /api/instances/return-to-stock` pour PICKED → PLACED

**Actions au placement** :
1. Instance : status → PLACED, `cabinet_location_id` assigné
2. Cabinet location : `is_empty = false`, `instance_id` assigné
3. Movement créé (type="placement" ou "retour")
4. Socket.IO : `inventory_changed`

#### 5.5.2 Vérification PIN admin

`POST /api/instances/verify-admin-pin`
- Utilisé pour les opérations exceptionnelles
- Vérifie le NIP ou card_id contre les admins/gestionnaires

---

## 6. API Backend — Endpoints complets

### 6.1 Authentification (`/api/auth`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/auth/register` | Inscription | Non |
| POST | `/api/auth/login` | Login email/password | Non |
| POST | `/api/auth/login-card` | Login carte employé | Non |
| POST | `/api/auth/login-pin` | Login NIP | Non |
| GET | `/api/auth/me` | Utilisateur courant | JWT |

### 6.2 Fournisseurs (`/api/suppliers`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/suppliers` | Liste | JWT |
| GET | `/api/suppliers/{id}` | Détail | JWT |
| POST | `/api/suppliers` | Créer (nom unique) | JWT |
| PUT | `/api/suppliers/{id}` | Modifier | JWT |
| DELETE | `/api/suppliers/{id}` | Supprimer (si non utilisé) | JWT |

### 6.3 Catégories / Modèles / Spécifications (`/api/product-*`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/product-categories` | Liste catégories | JWT |
| POST | `/api/product-categories` | Créer catégorie | JWT |
| PUT | `/api/product-categories/{id}` | Modifier | JWT |
| DELETE | `/api/product-categories/{id}` | Supprimer (si non utilisé) | JWT |
| GET | `/api/product-types` | Liste modèles | JWT |
| POST | `/api/product-types` | Créer modèle | JWT |
| PUT | `/api/product-types/{id}` | Modifier | JWT |
| DELETE | `/api/product-types/{id}` | Supprimer (si non utilisé) | JWT |
| GET | `/api/product-specifications` | Liste spécifications | JWT |
| POST | `/api/product-specifications` | Créer spécification | JWT |
| PUT | `/api/product-specifications/{id}` | Modifier | JWT |
| DELETE | `/api/product-specifications/{id}` | Supprimer (si non utilisé) | JWT |

### 6.4 Cabinets (`/api/cabinets`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/cabinets` | Liste (enrichie avec compteurs) | JWT |
| GET | `/api/cabinets/{id}` | Détail | JWT |
| POST | `/api/cabinets` | Créer + auto-génère locations N×M | JWT |
| PUT | `/api/cabinets/{id}` | Modifier | JWT |
| DELETE | `/api/cabinets/{id}` | Supprimer (si vide) | JWT |
| GET | `/api/cabinets/{id}/locations` | Matrice enrichie (instances, produits, types, specs) | JWT |
| PUT | `/api/cabinets/{id}/locations/{loc_id}` | Associer/désassocier produit | JWT |

### 6.5 Produits (`/api/products`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/products` | Liste enrichie (supplier, category, type, spec, stock) | JWT |
| GET | `/api/products/filter-options` | Options filtrées en cascade + produits matchant | JWT |
| GET | `/api/products/{id}` | Détail enrichi | JWT |
| GET | `/api/products/{id}/instances` | Instances avec localisation | JWT |
| POST | `/api/products` | Créer (valide FK) | JWT |
| PUT | `/api/products/{id}` | Modifier | JWT |
| DELETE | `/api/products/{id}` | Supprimer (si aucune instance) | JWT |

### 6.6 Instances (`/api/instances`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/instances` | Liste (filtres: status, product_id, order_id) | JWT |
| GET | `/api/instances/pending-placement` | Instances RECEIVED | JWT |
| GET | `/api/instances/consumption` | Instances PICKED + CONSUMED | JWT |
| GET | `/api/instances/available-stock` | Stock PLACED avec filtres cascade | JWT |
| PUT | `/api/instances/{id}/consume` | PICKED → CONSUMED | JWT |
| POST | `/api/instances/pick-libre` | Picking libre (PLACED → PICKED) | JWT |
| POST | `/api/instances/scan` | Scan N° série → détecte action | JWT |
| POST | `/api/instances/place` | Placement RECEIVED/PICKED → PLACED | JWT |
| POST | `/api/instances/return-to-stock` | Retour PICKED → PLACED | JWT |
| POST | `/api/instances/verify-admin-pin` | Vérification NIP admin | JWT |
| POST | `/api/instances/export-grm` | Export GRM + facturation CONSUMED→INVOICED | JWT |

### 6.7 Commandes (`/api/orders`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/orders` | Liste enrichie (supplier, item counts) | JWT |
| GET | `/api/orders/{id}` | Détail + items (instances enrichies) | JWT |
| POST | `/api/orders` | Créer commande + instances ORDERED | JWT |
| PUT | `/api/orders/{id}/send` | Envoyer (verrouiller) | JWT |
| PUT | `/api/orders/{id}/receive` | Réceptionner (SN requis, expiry requis, unique) | JWT |
| POST | `/api/orders/{id}/items` | Ajouter items (draft only) | JWT |
| DELETE | `/api/orders/{id}` | Annuler (draft only) | JWT |

### 6.8 Interventions (`/api/interventions`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/interventions` | Liste (filtres: filter, date, date_from, date_to) | JWT |
| GET | `/api/interventions/{id}` | Détail enrichi (produits avec résolution) | JWT |
| POST | `/api/interventions` | Créer (spec progressive) | JWT |
| PUT | `/api/interventions/{id}` | Modifier (datetime, MRN, birth_date, status) | JWT |
| DELETE | `/api/interventions/{id}` | Supprimer (+ intervention_products) | JWT |
| POST | `/api/interventions/{id}/products` | Ajouter produit (spec progressive) | JWT |
| PUT | `/api/interventions/{id}/products/{ip_id}` | Raffiner/modifier produit | JWT |
| DELETE | `/api/interventions/{id}/products/{ip_id}` | Retirer produit | JWT |
| POST | `/api/interventions/{id}/pick` | Prélever (FIFO, mismatch check) | JWT |
| GET | `/api/interventions/{id}/fifo-suggestions` | Suggestions FIFO enrichies | JWT |

### 6.9 Consommation (`/api/consumption`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/consumption/import/preview` | Upload Excel → matching preview | JWT |
| POST | `/api/consumption/import/confirm` | Confirmer consommation des matchés | JWT |
| GET | `/api/consumption/imports` | Historique des imports | JWT |

### 6.10 Employés (`/api/employees`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/employees` | Liste (sans secrets) | JWT |
| GET | `/api/employees/roles` | Rôles disponibles | JWT |
| GET | `/api/employees/{id}` | Détail | JWT |
| POST | `/api/employees` | Créer (admin only) | JWT |
| PUT | `/api/employees/{id}` | Modifier (admin only) | JWT |
| DELETE | `/api/employees/{id}` | Supprimer (admin only, pas soi-même) | JWT |

### 6.11 Mouvements (`/api/movements`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/movements` | Liste enrichie (produit, user, SN, lot) | JWT |
| GET | `/api/movements/export/excel` | Export Excel filtré | JWT |
| GET | `/api/movements/export/pdf` | Export PDF filtré | JWT |

### 6.12 Hardware (`/api/hardware`) — Stubs

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/hardware/cabinets/{id}/unlock` | Déverrouiller cabinet (stub) | JWT |
| POST | `/api/hardware/cabinets/{id}/lock` | Verrouiller cabinet (stub) | JWT |
| POST | `/api/hardware/locations/{id}/led` | Contrôle LED (stub) | JWT |
| GET | `/api/hardware/locations/{id}/presence` | Détecteur présence (stub) | JWT |
| POST | `/api/hardware/emergency` | Urgence — tout déverrouiller (stub) | JWT |

### 6.13 Système

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/health` | Health check | Non |

---

## 7. Événements Socket.IO

### 7.1 Infrastructure
- **Serveur** : `python-socketio` (AsyncServer, mode ASGI)
- **Client** : `socket.io-client` via hook `useSocketEvent`
- **Transport** : WebSocket (fallback polling)
- **Reconnexion** : Automatique, 10 tentatives, délai 2s

### 7.2 Événements émis par le serveur

| Événement | Émetteur | Données | Déclencheur |
|-----------|----------|---------|-------------|
| `intervention_changed` | Serveur → Tous | `{ action: "created"/"updated"/"picked"/"deleted", id }` | Création, modification, picking, suppression d'intervention |
| `inventory_changed` | Serveur → Tous | `{ action: "placed"/"returned"/"picked", instance_id? }` | Placement, retour, picking, import consommation |

### 7.3 Consommateurs côté frontend

| Page | Événements écoutés | Action |
|------|-------------------|--------|
| Admin Interventions | `intervention_changed`, `inventory_changed` | `fetchData()` |
| Light Interventions | `intervention_changed`, `inventory_changed` | `fetchData()` |
| Light Picking | `intervention_changed`, `inventory_changed` | Refresh suggestions |

### 7.4 Événements prévus Phase 5 (hardware)

| Événement | Direction | Payload |
|-----------|----------|---------|
| `cabinet:unlock` | Client → Serveur | `{ cabinetId }` |
| `cabinet:lock` | Client → Serveur | `{ cabinetId }` |
| `cabinet:status` | Serveur → Client | `{ cabinetId, locked: bool }` |
| `location:led` | Client → Serveur | `{ locationId, color, on: bool }` |
| `location:presence` | Serveur → Client | `{ locationId, hasProduct: bool }` |
| `emergency:activate` | Client → Serveur | `{ userId? }` |
| `emergency:status` | Serveur → Client | `{ active: bool }` |

---

## 8. Modèle de données

### 8.1 Collections MongoDB

| Collection | Description | Documents estimés |
|-----------|-------------|-------------------|
| `employees` | Utilisateurs du système | ~50 |
| `suppliers` | Fournisseurs de DMI | ~20 |
| `product_categories` | Catégories de produits | ~15 |
| `product_types` | Types/Modèles de produits | ~50 |
| `product_specifications` | Spécifications (dimensions, etc.) | ~100 |
| `products` | Catalogue de produits | ~500 |
| `product_instances` | Instances physiques de produits | ~5000 |
| `cabinets` | Armoires de stockage | ~10 |
| `cabinet_locations` | Emplacements dans les armoires | ~500 |
| `orders` | Commandes d'achat | ~200 |
| `interventions` | Interventions chirurgicales | ~1000 |
| `intervention_products` | Produits requis par intervention | ~3000 |
| `movements` | Journal d'audit | ~10000+ |
| `import_history` | Historique imports Excel | ~100 |

### 8.2 Index MongoDB
- `product_instances.serial_number` : unique, sparse

### 8.3 Schéma des documents clés

#### Employee
```json
{
  "id": "uuid",
  "email": "prenom.nom@hopital.com",
  "first_name": "Jean",
  "last_name": "Dupont",
  "role": "administrateur",
  "password_hash": "$2b$...",
  "pin_hash": "$2b$...",
  "card_id": "CARD001",
  "created_at": "2026-01-01T00:00:00+00:00"
}
```

#### Product
```json
{
  "id": "uuid",
  "supplier_id": "uuid",
  "category_id": "uuid",
  "type_id": "uuid",
  "specification_id": "uuid",
  "description": "Vis corticale 5.0mm x 30mm",
  "grm_number": "GRM-12345",
  "quantity_in_stock": 5,
  "created_at": "2026-01-01T00:00:00"
}
```

#### ProductInstance
```json
{
  "id": "uuid",
  "product_id": "uuid",
  "cabinet_location_id": "uuid",
  "serial_number": "SN-001234",
  "lot_number": "LOT-2026-01",
  "expiration_date": "2027-06-15T00:00:00",
  "usage_date": null,
  "reception_date": "2026-03-01T00:00:00",
  "status": 3,
  "order_id": "uuid",
  "created_at": "2026-01-01T00:00:00"
}
```

#### Intervention
```json
{
  "id": "uuid",
  "planned_datetime": "2026-04-13T09:00:00",
  "patient_file_number": "12345678",
  "birth_date": "1990-05-15",
  "status": "planned",
  "created_at": "2026-04-12T00:00:00"
}
```

#### InterventionProduct
```json
{
  "id": "uuid",
  "intervention_id": "uuid",
  "product_id": "uuid",
  "category_id": "uuid",
  "type_id": "uuid",
  "specification_id": "uuid",
  "instance_id": null,
  "serial_number": null,
  "required_quantity": 2,
  "picked_quantity": 0
}
```

#### Movement
```json
{
  "id": "uuid",
  "instance_id": "uuid",
  "product_id": "uuid",
  "type": "prelevement",
  "quantity": 1,
  "user_id": "uuid",
  "reason": "Prélèvement pour intervention - MRN: 12345678",
  "location_code": "Cabinet A-R1-C3",
  "intervention_id": "uuid",
  "order_id": null,
  "timestamp": "2026-04-13T09:30:00+00:00"
}
```

---

## 9. Cycle de vie ProductStatus

```
ORDERED (1) ──→ RECEIVED (2) ──→ PLACED (3) ──→ PICKED (4) ──→ CONSUMED (5) ──→ INVOICED (6)
                                       ↑              │
                                       └──────────────┘
                                     (retour en stock)
```

| Statut | Valeur | Label FR | Déclencheur |
|--------|--------|----------|------------|
| ORDERED | 1 | Commandé | Création de commande |
| RECEIVED | 2 | Réceptionné | Réception (assignation SN/lot/exp) |
| PLACED | 3 | En stock (Placé) | Placement physique en cabinet |
| PICKED | 4 | Prélevé | Picking (intervention ou libre) |
| CONSUMED | 5 | Consommé | Validation consommation ou import Excel |
| INVOICED | 6 | Facturé | Export GRM |

---

## 10. Règles métier

### 10.1 FIFO (First In, First Out)
- Le picking privilégie les instances avec la date d'expiration la plus proche
- Les instances sans date d'expiration passent après celles qui en ont
- Le tri secondaire est par `created_at` (plus ancien en premier)

### 10.2 Spécification progressive
- Un produit d'intervention peut être défini à n'importe quel niveau : Catégorie, Modèle, Spécification, Produit exact
- Au picking, le matching se fait par cascade : product_id exact, puis category+type+spec partiel
- Un produit partiellement spécifié peut être "complété" ultérieurement (Compléter/Raffiner)

### 10.3 Validation de correspondance au picking
- Si le produit scanné ne correspond à aucun `InterventionProduct` restant → mismatch warning
- L'utilisateur peut forcer le prélèvement malgré le mismatch (`force: true`)

### 10.4 Unicité des N° de série
- Index unique sparse sur `product_instances.serial_number`
- Vérifié à la réception de commande (doublon interdit)
- Permet les instances sans N° de série (status ORDERED)

### 10.5 Protection des entités liées
- Fournisseur : suppression impossible si utilisé par un produit
- Catégorie/Modèle/Spécification : suppression impossible si utilisé par un produit
- Produit : suppression impossible si des instances existent
- Cabinet : suppression impossible si contient des produits
- Employé : auto-suppression interdite

### 10.6 Fuseau horaire
- Toutes les dates sont stockées en UTC
- Les filtres d'interventions appliquent le fuseau `America/Toronto` (Eastern Time)
- Les exports (GRM, Excel, PDF) convertissent en `America/Toronto`

### 10.7 Commandes de remplacement
- L'export GRM crée automatiquement des commandes de remplacement
- Groupées par fournisseur
- Créées en statut `sent` avec `order_date` = maintenant

### 10.8 Import consommation Excel
- Le matching est tolérant : accepte des en-têtes variés (recherche par mots-clés)
- Priorité de matching : N° série > N° lot > description (regex)
- Une instance PLACED est automatiquement prélevée puis consommée (2 mouvements)
- Une instance PICKED est directement consommée (1 mouvement)

---

*Fin du document de spécifications fonctionnelles — Chrono DMI v2*
