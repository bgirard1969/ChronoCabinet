# Chrono DMI VF — Spécifications Fonctionnelles Complètes

*Document mis à jour le 14 avril 2026*
*Version Finale (VF)*

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles et permissions](#2-rôles-et-permissions)
3. [Authentification](#3-authentification)
4. [Gestion — Pages Administration](#4-gestion--pages-administration)
5. [Production — Pages Opérations](#5-production--pages-opérations)
6. [API Backend — Endpoints complets](#6-api-backend--endpoints-complets)
7. [Événements Socket.IO](#7-événements-socketio)
8. [Modèle de données](#8-modèle-de-données)
9. [Cycle de vie ProductStatus](#9-cycle-de-vie-productstatus)
10. [Règles métier](#10-règles-métier)

---

## 1. Vue d'ensemble

### 1.1 Description
Chrono DMI est un système de traçabilité de dispositifs médicaux implantables (DMI) pour milieu hospitalier. L'application gère le cycle de vie complet des produits : commande, réception, placement en cabinet, prélèvement FIFO pour interventions chirurgicales, consommation et facturation.

### 1.2 Architecture bi-client
L'application offre deux interfaces dans une même application React :

| Client | URL racine | Thème | Accès | Utilisateurs |
|--------|-----------|-------|-------|-------------|
| **Gestion** | `/management/*` | Clair (blanc) | Email + mot de passe | Gestionnaires, Administrateurs |
| **Production** | `/production/*` | Sombre (slate-900) | NIP / Carte employé | Cliniciens, Gestionnaires, Admins |

### 1.3 Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | React 18, Tailwind CSS, shadcn/ui, Lucide React, react-day-picker, date-fns |
| Backend | FastAPI, Motor (MongoDB async), Pydantic |
| Base de données | MongoDB |
| Temps réel | Socket.IO (python-socketio + socket.io-client) |
| Auth | JWT + bcrypt |
| Exports | xlsxwriter (Excel), reportlab (PDF) |
| Import | openpyxl (Excel consommation), csv (interventions CSV) |
| Fuseau horaire | America/Toronto (Eastern Time) |

### 1.4 Structure du projet

```
/app/
├── backend/
│   ├── server.py                # FastAPI + Socket.IO mount
│   ├── sio.py                   # Socket.IO server instance
│   ├── models.py                # Pydantic models + enums
│   └── routes/
│       ├── auth.py              # JWT login (email, PIN, carte)
│       ├── suppliers.py         # CRUD fournisseurs
│       ├── categories_types.py  # Catégories + Modèles + Spécifications
│       ├── cabinets.py          # Cabinets + emplacements (matrice N×M)
│       ├── products.py          # Produits + filter-options (cascade)
│       ├── instances.py         # ProductInstances (cycle de vie)
│       ├── orders.py            # Commandes d'achat
│       ├── interventions.py     # Interventions + produits + import CSV
│       ├── consumption.py       # Import Excel consommation
│       ├── employees.py         # CRUD employés
│       ├── movements.py         # Journal d'audit + exports PDF/Excel
│       └── hardware.py          # Stubs hardware (Phase future)
│
├── frontend/src/
│   ├── App.js                   # Routeur (/management/*, /production/*)
│   ├── components/
│   │   ├── ui/                  # shadcn (Calendar, Popover, etc.)
│   │   └── interventions/       # Composants partagés
│   │       ├── useStockBrowser.js
│   │       ├── interventionHelpers.js
│   │       ├── CascadingFilters.jsx
│   │       ├── StockResultsTable.jsx
│   │       └── InterventionFormFields.jsx
│   ├── pages/admin/             # Gestion
│   │   ├── AdminLayout.js
│   │   ├── Interventions.js
│   │   ├── Cabinets.js
│   │   ├── Products.js
│   │   ├── Orders.js
│   │   ├── Consumption.js
│   │   ├── Employees.js
│   │   └── Movements.js
│   └── pages/light/             # Production
│       ├── Login.js
│       ├── Interventions.js
│       ├── Picking.js
│       ├── PickingLibre.js
│       └── Restock.js
```

---

## 2. Rôles et permissions

### 2.1 Définition des rôles

| Rôle | Client Gestion | Client Production | Description |
|------|---------------|------------------|-------------|
| Administrateur | Accès complet | Accès complet + gestion | Accès total |
| Gestionnaire | Accès complet | Accès complet + gestion | Gestion des stocks, commandes |
| Technicien | — | Picking + Mise en stock | Opérations de stock |
| Clinicien | — | Interventions + Picking | Prélèvement uniquement |
| Lecture | Consultation seule | — | Consultation uniquement |

### 2.2 Matrice d'accès Gestion

| Page | Administrateur | Gestionnaire | Lecture |
|------|---------------|-------------|---------|
| Interventions | CRUD + Import CSV | CRUD + Import CSV | Lecture |
| Cabinets | CRUD complet | CRUD complet | Lecture |
| Produits (5 onglets) | CRUD complet | CRUD complet | Lecture |
| Commandes | CRUD complet | CRUD complet | Lecture |
| Consommation | Import + validation | Import + validation | Lecture |
| Employés | CRUD complet | Non | Non |
| Mouvements | Lecture + export | Lecture + export | Lecture |

### 2.3 Matrice d'accès Production

| Fonctionnalité | Admin | Gestionnaire | Technicien | Clinicien |
|---------------|-------|-------------|-----------|----------|
| Voir interventions du jour | Oui | Oui | Non | Oui |
| Filtrer par MRN / Salle | Oui | Oui | Non | Oui |
| Picking (par intervention) | Oui | Oui | Oui | Oui |
| Picking Libre | Oui | Oui | Oui | Non |
| Mise en stock | Oui | Oui | Oui | Non |
| Créer/modifier intervention | Oui | Oui | Non | Non |
| Supprimer intervention | Oui | Oui | Non | Non |

---

## 3. Authentification

### 3.1 Email + Mot de passe (Gestion)
- **Page** : `/`
- **API** : `POST /api/auth/login`
- **Payload** : `{ email, password }`
- **Réponse** : `{ access_token, token_type, user }`
- **Token JWT** : expire après 480 min (8h — quart hospitalier)
- **Redirection** : → `/management/interventions`

### 3.2 NIP (Production)
- **Page** : `/production/login`
- **Interface** : Numpad tactile (0-9, C, ←)
- **API** : `POST /api/auth/login-pin`
- **Payload** : `{ pin }`
- **Redirection** : → `/production/interventions`

### 3.3 Carte employé (Production)
- **Page** : `/production/login` (onglet "Carte")
- **API** : `POST /api/auth/login-card`
- **Payload** : `{ card_id }`

### 3.4 Urgence (Production)
- **Bouton** : "URGENCE" (rouge) en bas du numpad
- **Comportement** : Connexion rapide sans authentification complète

### 3.5 Gestion du token
- **Stockage** : `localStorage` (`token`, `clientMode`)
- **Intercepteur Axios** : `Authorization: Bearer {token}` automatique
- **Vérification** : `GET /api/auth/me`
- **Expiration** : 401 → suppression token → redirection login

---

## 4. Gestion — Pages Administration

### 4.1 Page de connexion (`/`)
- Logo "Chrono DMI" + sous-titre
- Titre : **Gestion**
- Formulaire email/mot de passe
- Lien "Accéder à Production" → `/production/login`

### 4.2 Layout Gestion (`/management/*`)

**Sidebar** :

| Icône | Label | Route |
|-------|-------|-------|
| Calendar | Interventions | `/management/interventions` |
| Box | Cabinets | `/management/cabinets` |
| Package | Produits | `/management/products` |
| ShoppingCart | Commandes | `/management/orders` |
| ClipboardCheck | Consommation | `/management/consumption` |
| Users | Employés | `/management/employees` |
| Activity | Mouvements | `/management/movements` |

**Footer** : Initiales, nom, rôle, "Déconnexion"

---

### 4.3 Interventions (`/management/interventions`)

#### 4.3.1 En-tête
- Titre "Interventions" + sous-titre
- **Bouton "Importer CSV"** : Upload fichier `.csv` → création en masse d'interventions
- **Bouton "+ Nouvelle intervention"** : Ouvre modal de création

#### 4.3.2 Filtres (barre unique)

| Filtre | Type | Comportement |
|--------|------|-------------|
| Aujourd'hui | Bouton toggle | `filter=today` (défaut) |
| Cette semaine | Bouton toggle | `filter=week` |
| Toutes | Bouton toggle | `filter=all` |
| Période | Popover calendrier | Plage de dates (2 mois, locale fr) |
| MRN | Champ texte (max 10 car.) | Filtre client-side par MRN |
| Salle | Boutons violet toggle | Filtre client-side par salle (clic=filtre, re-clic=désactive) |

**Boutons Salle** : Générés dynamiquement à partir des salles présentes dans les interventions. Style violet clair au repos, violet plein quand actif. Pas de bouton "Toutes" — par défaut tout est affiché.

#### 4.3.3 Tableau des interventions
Trié par salle ascending.

| Colonne | Contenu |
|---------|---------|
| Date | Date seule (format `fr-CA`) |
| Salle | Badge violet avec numéro (2 digits) ou "—" |
| MRN | `patient_file_number` ou "—" |
| Date naissance | `birth_date` ou "—" |
| Produits | Badge "{N} produit(s)" ou "—" |
| Statut | Badge coloré (Planifiée / En cours / Terminée / Annulée) |

**Clic sur une ligne** → panneau détail.

#### 4.3.4 Import CSV

**Bouton** : "Importer CSV" (icône Upload)

**Format CSV attendu** (séparateur virgule) :

| Colonne CSV | Champ intervention | Requis |
|------------|-------------------|--------|
| `date_intervention_prevue` | Date (planned_datetime) | Oui |
| `salle` | Salle (operating_room) | Non |
| `mrn_patient` | MRN (patient_file_number) | Non |
| `date_naissance` | Date naissance (birth_date) | Non |

**Colonnes ignorées** : `date_extraction_donnee`, `date_priorite`, `intervention` (présentes dans le fichier mais non utilisées)

**Comportement** :
- Chaque ligne crée une intervention avec statut `planned`, sans produits
- **Dédoublonnage fichier** : même date+salle+MRN dans le fichier → 1 seule création
- **Dédoublonnage base** : si une intervention avec même date+salle+MRN existe déjà en base → ignorée
- **Encodage** : UTF-8 avec BOM supporté, fallback Latin-1
- **Réponse** : `{ created, duplicates, errors, total_lines }`
- **Toast** : "X intervention(s) créée(s), Y doublon(s) ignoré(s)"

**API** : `POST /api/interventions/import-csv` (multipart/form-data)

#### 4.3.5 Modal création

**Champs** (4 colonnes en ligne) :

| Champ | Type | Requis | Placeholder |
|-------|------|--------|------------|
| Date | `date` | Oui | — |
| Salle | `text` (2 digits max, numérique) | Non | "Ex: 05" |
| MRN | `text` | Non | "Facultatif" |
| Date naissance | `date` | Non | — |

**Section produits** :
- Filtres en cascade (CascadingFilters) : 3 colonnes
- Table résultats (StockResultsTable) : Description, N° série, Stock, "+"
- Produits sélectionnés avec quantité ± et suppression
- Bouton "Ajouter : {label}" pour ajout au niveau filtre

**API** : `POST /api/interventions`

#### 4.3.6 Panneau détail
- En-tête : Date + Salle + MRN + Date naissance
- Boutons : Modifier (crayon), Supprimer (poubelle), Fermer (X)
- Liste produits avec badges de résolution (Instance/Produit/Spécification/Modèle/Catégorie)
- Bouton "Compléter" pour spécification progressive
- Contrôles quantité (- / + / supprimer)
- Section ajouter/compléter avec filtres cascadés

#### 4.3.7 Modal modification
- Mêmes 4 champs (Date, Salle, MRN, Date naissance) pré-remplis
- **API** : `PUT /api/interventions/{id}`

#### 4.3.8 Dialog suppression
- Confirmation irréversible
- **API** : `DELETE /api/interventions/{id}`

---

### 4.4 Cabinets (`/management/cabinets`)

#### 4.4.1 Liste des cabinets
- Tableau : Description, Dimensions (R×C), Occupation
- Bouton "Nouveau cabinet"

#### 4.4.2 Formulaire création

| Champ | Type |
|-------|------|
| Description | `text` |
| Lignes (rows) | `number` |
| Colonnes (columns) | `number` |

**API** : `POST /api/cabinets` → auto-génère N×M emplacements

#### 4.4.3 Vue matrice N×M
- Grille interactive par emplacement
- Couleurs : vide (gris), désigné (bleu), occupé (vert/jaune/rouge selon expiration)
- Badges expiration, tooltips, barres de remplissage

---

### 4.5 Produits (`/management/products`)

#### 4.5.1 Navigation par onglets (5)

| Onglet | Collection | CRUD |
|--------|-----------|------|
| Produits | `products` | Oui |
| Fournisseurs | `suppliers` | Oui |
| Catégories | `product_categories` | Oui |
| Modèles | `product_types` | Oui |
| Spécifications | `product_specifications` | Oui |

#### 4.5.2 Onglet Produits — Filtres

| Filtre | Type | Cascadé |
|--------|------|---------|
| Recherche | Texte libre | Non — surlige en **jaune** les occurrences trouvées |
| Catégorie | Select dropdown | Non (racine) |
| Modèle | Select dropdown | Oui — ne montre que les modèles ayant des produits dans la catégorie sélectionnée |
| Spécification | Select dropdown | Oui — ne montre que les spécifications ayant des produits dans la catégorie+modèle sélectionnés |
| Fournisseur | Select dropdown | Non |

**Indicateur filtre actif** : Bordure bleue épaisse + fond bleu clair + texte bleu gras sur le dropdown actif.
**Bouton "Réinitialiser"** : Apparaît quand un filtre est actif. Efface tous les filtres.
**Reset cascadé** : Changer la catégorie réinitialise modèle et spécification. Changer le modèle réinitialise la spécification.

#### 4.5.3 Tableau produits

| Colonne | Style |
|---------|-------|
| GRM | Taille normale, font-mono |
| Description | Font-medium, surlignage jaune si recherche active |
| Catégorie | Badge bleu |
| Modèle | Badge violet |
| Spécification | Texte, surlignage jaune si recherche active |
| Fournisseur | Texte |
| En stock | Gras |

**Clic sur une ligne** → panneau instances (N° série, lot, expiration, emplacement, statut)

#### 4.5.4 Formulaire produit (ordre)

| Champ | Type | Requis |
|-------|------|--------|
| Description | `text` (80 max) | Oui |
| Fournisseur | `select` | Oui |
| Catégorie | `select` | Oui |
| Modèle | `select` | Oui |
| Spécification | `select` | Non |
| N° GRM | `text` | Non |

---

### 4.6 Commandes (`/management/orders`)

#### 4.6.1 Tableau
- **Tri par défaut** : Date d'envoi descendant
- **Tri cliquable** sur chaque colonne
- Colonnes : Fournisseur, N° GRM, Statut, Date création, Date envoi, Items

#### 4.6.2 Statuts de commande

| Statut | Label | Couleur |
|--------|-------|---------|
| `draft` | Brouillon | Gris |
| `sent` | Envoyée | Bleu |
| `partially_received` | Partiellement reçue | Jaune |
| `received` | Reçue | Vert |
| `closed` | Fermée | Slate |
| `cancelled` | Annulée | Rouge |

#### 4.6.3 Workflow

```
1. Créer → Sélection fournisseur + produits → instances ORDERED
2. Envoyer → Verrouille, set order_date, status="sent"
3. Réceptionner → Assigner SN (requis, unique), lot, expiration (requis) → RECEIVED
4. Annuler → Draft uniquement, supprime instances ORDERED
```

#### 4.6.4 Export GRM
- `POST /api/instances/export-grm`
- Fichier pipe-delimited, fuseau America/Toronto
- Transition CONSUMED → INVOICED
- Commandes de remplacement par fournisseur

---

### 4.7 Consommation (`/management/consumption`)

#### 4.7.1 Import Excel

**Upload** : `POST /api/consumption/import/preview`

**Colonnes parsées** (par mots-clés dans l'en-tête) :

| Mot-clé | Champ |
|---------|-------|
| `mrn` | MRN patient |
| `naissance` | Date de naissance |
| `serie`/`série` | N° de série |
| `lot` + `no` | N° de lot |
| `description` + `produit` | Description |

**Résultats de matching** :

| Panneau | Statut | Description |
|---------|--------|------------|
| Trouvé | `matched` | Correspondance exacte (SN/Lot) |
| Non trouvé | `unmatched` | SN ou Lot fourni mais non trouvé |
| À vérifier | `manual` | Ni SN ni Lot fourni |

**Confirmation** : `POST /api/consumption/import/confirm`
- PLACED → libère cabinet → CONSUMED (2 mouvements)
- PICKED → CONSUMED (1 mouvement)

#### 4.7.2 Historique
- `GET /api/consumption/imports`

---

### 4.8 Employés (`/management/employees`)

**Restriction** : Administrateurs uniquement.

| Champ | Type | Requis |
|-------|------|--------|
| Prénom | `text` | Oui |
| Nom | `text` | Oui |
| Email | `email` (unique) | Oui |
| Mot de passe | `password` | Oui (création) |
| Rôle | `select` | Oui |
| NIP | `text` (4+ chiffres) | Non |
| ID Carte | `text` (unique) | Non |

---

### 4.9 Mouvements (`/management/movements`)

#### 4.9.1 Filtres

| Filtre | Type |
|--------|------|
| Recherche texte | Input |
| N° Série | Input (icône scan) |
| N° Lot | Input (icône scan) |
| Plage de dates | Popover calendrier (2 mois, locale fr) |
| Type | Boutons toggle (Tous, Commandé, Réception, Placement, Prélèvement, Retour, Consommation, Facturation) |

#### 4.9.2 Tableau

| Colonne | Triable |
|---------|---------|
| Date/Heure | Oui (défaut desc) |
| Type | Oui |
| Produit | Oui |
| N° Série | Oui |
| N° Lot | Oui |
| Emplacement | Oui |
| Utilisateur | Oui |
| Détail | Oui |

#### 4.9.3 Exports

**Excel** : `GET /api/movements/export/excel`
- Format : `.xlsx` (xlsxwriter)
- Respecte les filtres actifs

**PDF** : `GET /api/movements/export/pdf`
- Format : PDF paysage (reportlab)
- Titre dynamique avec période
- Respecte les filtres actifs

---

## 5. Production — Pages Opérations

### 5.1 Login (`/production/login`)
- Titre : **Production**
- **Onglet NIP** : Numpad tactile, chiffres masqués (●●●●)
- **Onglet Carte** : Champ de scan auto-focus
- **Bouton Urgence** : Rouge en bas
- **Lien retour** : "← Gestion" → `/`

---

### 5.2 Interventions du jour (`/production/interventions`)

#### 5.2.1 Barre de filtres (une ligne)

| Élément | Description |
|---------|------------|
| Calendrier compact | `← Aujourd'hui 📅 →` (flèches, label, date picker caché) |
| MRN | Champ compact `🔍 MRN...` (max 10 car., largeur fixe) |
| Boutons Salle | Boîtes violet "SALLE {N}" — clic filtre, re-clic désactive |

**Calendrier** : Même hauteur que le champ MRN. Bouton "Aujourd'hui" bleu quand date = aujourd'hui.

**Boutons Salle** : Style `bg-violet-950/60` au repos, `bg-violet-600 text-white` quand actif. Pas de contour. Générés dynamiquement à partir des salles de la journée.

#### 5.2.2 Boutons d'action (gestionnaire/admin)

| Bouton | Couleur | Action |
|--------|---------|--------|
| Mise en stock | Vert | → `/production/restock` |
| PICKING | Bleu | → `/production/picking-libre` |
| + Intervention | Violet | Modal création |

#### 5.2.3 Liste des interventions
Triée par salle ascending. Chaque carte affiche :
- **Boîte Salle** (violet, "SALLE" + numéro en gros) ou "—"
- MRN + "Né(e): {date}"
- "{N} produit(s) requis"
- Bouton → (navigate picking)
- Bouton crayon (modal édition)

#### 5.2.4 Modal création/édition

**Formulaire** (InterventionFormFields, dark) :
- 4 champs en ligne : Date, Salle (2 digits), MRN, Date naissance
- Section produits avec filtres cascadés (dark)

---

### 5.3 Picking FIFO (`/production/picking/:interventionId`)

#### 5.3.1 En-tête intervention (4 colonnes)

| Champ | Label |
|-------|-------|
| DATE OPÉRATION | Date (format fr-CA) |
| MRN | patient_file_number |
| DATE NAISSANCE | birth_date |
| SALLE | operating_room |

#### 5.3.2 Suggestions FIFO
- `GET /api/interventions/{id}/fifo-suggestions`
- Par produit : description à gauche, localisation cabinet en grand à droite
- Sous-lignes par instance : SN, expiration, localisation, bouton "Prélever"
- Bouton refresh, édition inline, ajout dynamique

#### 5.3.3 Prélèvement
- `POST /api/interventions/{id}/pick`
- Validation mismatch (force possible)
- PLACED → PICKED, libère cabinet, incrémente picked_quantity

---

### 5.4 Picking Libre (`/production/picking-libre`)

#### 5.4.1 En-tête — 4 champs

| Champ | Label | Type |
|-------|-------|------|
| DATE OPÉRATION | Date opération | `date` |
| MRN | MRN | `text` |
| DATE NAISSANCE | Date naissance | `date` |
| SALLE | Salle | `text` (2 digits, numérique) |

#### 5.4.2 Workflow
1. Scan N° de série (champ dédié + bouton OK)
2. Filtres cascadés : Catégorie → Modèle → Spécification
3. Sélection produit → Prélèvement
4. `POST /api/instances/pick-libre`

---

### 5.5 Mise en stock (`/production/restock`)

#### 5.5.1 Flux unifié

| Statut instance | Action | Comportement |
|----------------|--------|-------------|
| RECEIVED | `place` | Placement initial en cabinet |
| PICKED | `return_to_stock` | Remise en stock |
| PLACED | `already_placed` | Déjà en stock |
| CONSUMED/INVOICED | `unavailable` | Non disponible |
| Non trouvé | `unknown` | SN inconnu |

---

## 6. API Backend — Endpoints complets

### 6.1 Authentification (`/api/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Login email/password |
| POST | `/api/auth/login-card` | Login carte employé |
| POST | `/api/auth/login-pin` | Login NIP |
| GET | `/api/auth/me` | Utilisateur courant |

### 6.2 Fournisseurs (`/api/suppliers`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/suppliers` | Liste |
| GET | `/api/suppliers/{id}` | Détail |
| POST | `/api/suppliers` | Créer |
| PUT | `/api/suppliers/{id}` | Modifier |
| DELETE | `/api/suppliers/{id}` | Supprimer |

### 6.3 Catégories / Modèles / Spécifications

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/product-categories` | Liste catégories |
| POST | `/api/product-categories` | Créer |
| PUT | `/api/product-categories/{id}` | Modifier |
| DELETE | `/api/product-categories/{id}` | Supprimer |
| GET | `/api/product-types` | Liste modèles |
| POST | `/api/product-types` | Créer |
| PUT | `/api/product-types/{id}` | Modifier |
| DELETE | `/api/product-types/{id}` | Supprimer |
| GET | `/api/product-specifications` | Liste spécifications |
| POST | `/api/product-specifications` | Créer |
| PUT | `/api/product-specifications/{id}` | Modifier |
| DELETE | `/api/product-specifications/{id}` | Supprimer |

### 6.4 Cabinets (`/api/cabinets`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/cabinets` | Liste enrichie |
| GET | `/api/cabinets/{id}` | Détail |
| POST | `/api/cabinets` | Créer + auto-génère N×M |
| PUT | `/api/cabinets/{id}` | Modifier |
| DELETE | `/api/cabinets/{id}` | Supprimer |
| GET | `/api/cabinets/{id}/locations` | Matrice enrichie |
| PUT | `/api/cabinets/{id}/locations/{loc_id}` | Associer/désassocier produit |

### 6.5 Produits (`/api/products`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/products` | Liste enrichie |
| GET | `/api/products/filter-options` | Options cascadées + produits |
| GET | `/api/products/{id}` | Détail |
| GET | `/api/products/{id}/instances` | Instances avec localisation |
| POST | `/api/products` | Créer |
| PUT | `/api/products/{id}` | Modifier |
| DELETE | `/api/products/{id}` | Supprimer |

### 6.6 Instances (`/api/instances`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/instances` | Liste (filtres: status, product_id, order_id) |
| GET | `/api/instances/pending-placement` | Instances RECEIVED |
| GET | `/api/instances/consumption` | Instances PICKED + CONSUMED |
| GET | `/api/instances/available-stock` | Stock PLACED avec filtres cascade |
| PUT | `/api/instances/{id}/consume` | PICKED → CONSUMED |
| POST | `/api/instances/pick-libre` | Picking libre |
| POST | `/api/instances/scan` | Scan SN → détecte action |
| POST | `/api/instances/place` | Placement → PLACED |
| POST | `/api/instances/return-to-stock` | Retour → PLACED |
| POST | `/api/instances/verify-admin-pin` | Vérification NIP admin |
| POST | `/api/instances/export-grm` | Export GRM + facturation |

### 6.7 Commandes (`/api/orders`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/orders` | Liste enrichie |
| GET | `/api/orders/{id}` | Détail + items |
| POST | `/api/orders` | Créer + instances ORDERED |
| PUT | `/api/orders/{id}/send` | Envoyer |
| PUT | `/api/orders/{id}/receive` | Réceptionner |
| POST | `/api/orders/{id}/items` | Ajouter items (draft) |
| DELETE | `/api/orders/{id}` | Annuler (draft) |

### 6.8 Interventions (`/api/interventions`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/interventions` | Liste (filtres: filter, date, date_from, date_to) |
| POST | `/api/interventions/import-csv` | **Import CSV** (multipart, dédoublonnage) |
| GET | `/api/interventions/{id}` | Détail enrichi |
| POST | `/api/interventions` | Créer (spécification progressive) |
| PUT | `/api/interventions/{id}` | Modifier |
| DELETE | `/api/interventions/{id}` | Supprimer |
| POST | `/api/interventions/{id}/products` | Ajouter produit |
| PUT | `/api/interventions/{id}/products/{ip_id}` | Raffiner produit |
| DELETE | `/api/interventions/{id}/products/{ip_id}` | Retirer produit |
| POST | `/api/interventions/{id}/pick` | Prélever (FIFO, mismatch check) |
| GET | `/api/interventions/{id}/fifo-suggestions` | Suggestions FIFO |

### 6.9 Consommation (`/api/consumption`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/consumption/import/preview` | Upload Excel → matching |
| POST | `/api/consumption/import/confirm` | Confirmer consommation |
| GET | `/api/consumption/imports` | Historique imports |

### 6.10 Employés (`/api/employees`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/employees` | Liste |
| GET | `/api/employees/roles` | Rôles disponibles |
| GET | `/api/employees/{id}` | Détail |
| POST | `/api/employees` | Créer (admin only) |
| PUT | `/api/employees/{id}` | Modifier (admin only) |
| DELETE | `/api/employees/{id}` | Supprimer (admin only) |

### 6.11 Mouvements (`/api/movements`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/movements` | Liste enrichie |
| GET | `/api/movements/export/excel` | Export Excel filtré (.xlsx) |
| GET | `/api/movements/export/pdf` | Export PDF filtré (paysage) |

### 6.12 Hardware — Stubs (`/api/hardware`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/hardware/cabinets/{id}/unlock` | Déverrouiller (stub) |
| POST | `/api/hardware/cabinets/{id}/lock` | Verrouiller (stub) |
| POST | `/api/hardware/locations/{id}/led` | Contrôle LED (stub) |
| GET | `/api/hardware/locations/{id}/presence` | Détecteur présence (stub) |
| POST | `/api/hardware/emergency` | Urgence (stub) |

### 6.13 Système

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Health check |

---

## 7. Événements Socket.IO

### 7.1 Infrastructure
- **Serveur** : `python-socketio` (AsyncServer, ASGI)
- **Client** : `socket.io-client` via hook `useSocketEvent`
- **Reconnexion** : Automatique, 10 tentatives

### 7.2 Événements actifs

| Événement | Direction | Déclencheur |
|-----------|----------|-------------|
| `intervention_changed` | Serveur → Tous | Création, modification, picking, suppression, import CSV |
| `inventory_changed` | Serveur → Tous | Placement, retour, picking, import consommation |

### 7.3 Consommateurs

| Page | Événements | Action |
|------|-----------|--------|
| Gestion Interventions | `intervention_changed`, `inventory_changed` | `fetchData()` |
| Production Interventions | `intervention_changed`, `inventory_changed` | `fetchData()` |
| Production Picking | `intervention_changed`, `inventory_changed` | Refresh |

### 7.4 Événements prévus (hardware)

| Événement | Direction |
|-----------|----------|
| `cabinet:unlock` / `cabinet:lock` | Client → Serveur |
| `cabinet:status` | Serveur → Client |
| `location:led` | Client → Serveur |
| `location:presence` | Serveur → Client |
| `emergency:activate` / `emergency:status` | Bidirectionnel |

---

## 8. Modèle de données

### 8.1 Collections MongoDB

| Collection | Description |
|-----------|-------------|
| `employees` | Utilisateurs |
| `suppliers` | Fournisseurs |
| `product_categories` | Catégories |
| `product_types` | Modèles |
| `product_specifications` | Spécifications |
| `products` | Catalogue |
| `product_instances` | Instances physiques |
| `cabinets` | Armoires |
| `cabinet_locations` | Emplacements N×M |
| `orders` | Commandes d'achat |
| `interventions` | Interventions chirurgicales |
| `intervention_products` | Produits par intervention |
| `movements` | Journal d'audit |
| `import_history` | Historique imports Excel |

### 8.2 Schéma Intervention

```json
{
  "id": "uuid",
  "planned_datetime": "2026-04-14T00:00:00",
  "operating_room": "18",
  "patient_file_number": "00825903",
  "birth_date": "1952-03-19",
  "status": "planned",
  "created_at": "2026-04-13T00:00:00"
}
```

### 8.3 Schéma InterventionProduct

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

### 8.4 Schéma ProductInstance

```json
{
  "id": "uuid",
  "product_id": "uuid",
  "cabinet_location_id": "uuid",
  "serial_number": "SN-001234",
  "lot_number": "LOT-2026-01",
  "expiration_date": "2027-06-15T00:00:00",
  "status": 3,
  "order_id": "uuid"
}
```

### 8.5 Schéma Movement

```json
{
  "id": "uuid",
  "instance_id": "uuid",
  "product_id": "uuid",
  "type": "prelevement",
  "quantity": 1,
  "user_id": "uuid",
  "reason": "Prélèvement pour intervention - MRN: 00825903",
  "location_code": "Cabinet Rose-R1-C2",
  "intervention_id": "uuid",
  "timestamp": "2026-04-14T09:30:00+00:00"
}
```

---

## 9. Cycle de vie ProductStatus

```
ORDERED (1) → RECEIVED (2) → PLACED (3) → PICKED (4) → CONSUMED (5) → INVOICED (6)
                                    ↑            │
                                    └────────────┘
                                  (retour en stock)
```

| Statut | Valeur | Déclencheur |
|--------|--------|------------|
| ORDERED | 1 | Création de commande |
| RECEIVED | 2 | Réception (SN/lot/exp assignés) |
| PLACED | 3 | Placement physique en cabinet |
| PICKED | 4 | Picking (intervention ou libre) |
| CONSUMED | 5 | Validation consommation ou import Excel |
| INVOICED | 6 | Export GRM |

---

## 10. Règles métier

### 10.1 FIFO
- Priorité : date d'expiration la plus proche
- Sans expiration : après celles qui en ont
- Secondaire : `created_at` (plus ancien d'abord)

### 10.2 Spécification progressive
- InterventionProduct : Catégorie → Modèle → Spécification → Produit → Instance
- Ajout à n'importe quel niveau
- "Compléter" pour affiner ultérieurement

### 10.3 Validation mismatch au picking
- Si produit scanné ne correspond pas → warning avec option `force: true`

### 10.4 Unicité N° de série
- Index unique sparse sur `product_instances.serial_number`
- Vérifié à la réception

### 10.5 Protection entités liées
- Fournisseur/Catégorie/Modèle/Spécification : suppression impossible si utilisé
- Produit : suppression impossible si instances existent
- Cabinet : suppression impossible si contient des produits
- Employé : auto-suppression interdite

### 10.6 Fuseau horaire
- Stockage UTC, filtres en America/Toronto (ET)
- Exports convertis en ET

### 10.7 Commandes de remplacement
- Export GRM crée automatiquement des commandes groupées par fournisseur

### 10.8 Import CSV interventions
- Dédoublonnage fichier : même (date+salle+MRN) → 1 seule
- Dédoublonnage base : même (date+salle+MRN) existant → ignoré
- Encodage : UTF-8 BOM + fallback Latin-1
- Statut : `planned`, sans produits

### 10.9 Import Excel consommation
- Matching : N° série > N° lot > description (regex)
- PLACED → prélevé + consommé (2 mouvements)
- PICKED → consommé (1 mouvement)

### 10.10 Filtres cascadés produits
- Catégorie filtre les Modèles disponibles
- Modèle filtre les Spécifications disponibles
- Surlignage jaune de la recherche dans le tableau

---

*Fin du document — Chrono DMI VF — Spécifications Fonctionnelles Complètes*
*Mis à jour le 14 avril 2026*
