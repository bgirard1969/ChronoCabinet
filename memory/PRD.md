# Chrono DMI v2 — PRD (NestJS + Angular 21 Stack)

## Original Problem Statement
Application de gestion d'inventaire de dispositifs medicaux (DMI) avec deux interfaces:
- **Client Lourd (Gestion)**: Desktop, gestion complete
- **Client Leger (Production)**: Tablette, picking FIFO, mise en stock

## Stack
- Backend: NestJS + TypeORM + SQLite (dev) / MSSQL (prod)
- Frontend: Angular 21 + PrimeNG v21 + Poppins font
- Architecture: Python ASGI proxy (port 8001) -> NestJS (port 8002)

## Backend (COMPLET)
83+ endpoints API, 14 entites TypeORM

## Frontend (COMPLET)
### Gestion (/management/*)
- Login, Layout sidebar, Interventions (CRUD + import CSV + calendrier plage), Cabinets, Produits (bouton dynamique par onglet), Commandes, Consommation, Employes (CRUD complet), Mouvements

### Production (/production/*)
- Login NIP, Interventions du jour, Picking FIFO, Picking Libre, Mise en stock

## UI/UX (COMPLET - 15 Avril 2026)
- Toggle dark/light mode, police Poppins, animations, boutons tactiles
- Accents francais corriges partout
- Import CSV : resume visuel + liste detaillee lignes creees/doublons
- Interventions : modifier/supprimer, calendrier plage de dates
- Employes : modifier (crayon) + supprimer
- Produits : bouton dynamique par onglet
- "Specification" renomme "Variante" partout

## Test Credentials
- Admin: benoit.girard@atmshealth.com / Salut123 (PIN: 1234)
- Clinicien: clinicien@atmshealth.com / Clinicien123

## Workflow Commandes & Instances (16 Avril 2026)
- [x] Etape 1: Backend add/remove items brouillon
- [x] Etape 2: Backend auto-assignation emplacement
- [x] Etape 3: Backend scan intelligent
- [x] Etape 4: Frontend Gestion Commandes
- [x] Etape 5: Frontend Production Restock

## Ajout produit intervention au niveau categorie (16 Avril 2026)
- [x] Backend: enrichIntervention() retourne category/type/spec names pour chaque InterventionProduct
- [x] Frontend: Colonnes cascading avec Categorie * (obligatoire), Modele (optionnel), Variante (optionnel)
- [x] Bouton principal "+ Ajouter : [categorie] (modele/variante a preciser)"
- [x] Tags: "Categorie" orange + badge "Modele/variante a preciser" pour ajouts au niveau categorie
- [x] Section repliable "Ou choisir un produit specifique" pour usage avance
- [x] Nettoyage code mort: Formulaire d'instances supprime du composant Produits (lecture seule)

## Ajout colonne Catalogue Fournisseur (16 Avril 2026)
- [x] Backend: Ajout champ `supplier_catalog_number` (varchar 80) dans l'entite Product
- [x] Frontend: Colonne dans la table + champ dans le formulaire creation/modification

## Corrections module Mouvements (16 Avril 2026)
- [x] Labels francais corriges: Prelevement, Reception, Place
- [x] Emplacement: resolution UUID -> nom cabinet + position (ex: "Cabinet Rose R1-C1")
- [x] Boutons de tri par statut (Tous, Prelevement, Reception, Place, Consomme, Facture, Retour)
- [x] Export PDF corrige avec pdfkit (vrai fichier PDF au lieu de texte brut)

## Ajout type "Facture" dans Mouvements (17 Avril 2026)
- [x] Backend: consumption.sendToGrm() enregistre desormais 2 mouvements distincts:
  - `consommation` (si item encore au statut Prelevement)
  - `facturation` toujours enregistre apres envoi GRM (reason: "Envoi GRM")
- [x] Controller + exports Excel/PDF: label "Facture" applique
- [x] Filtre UI deja present et fonctionnel

## Next Steps
1. (P1) Import CSV pour Commandes (parser, valider, previsualiser, auto-creer)
2. (P1) Commande Reapprovisionnement (verifier stock minimum, auto-selection produits)
3. (P2) Socket.IO temps reel entre Gestion et Production
4. (P2) Migration SQLite -> MSSQL

## Corrections auto-refresh dev server (18 Avril 2026)
- [x] Diagnostic: Dev server Angular/Vite declenchait un reload complet de la page (~30s) via WebSocket HMR, fermant les dialogs/modals ouverts
- [x] Fix: ajout de `--live-reload=false --hmr=false` au script `start` de `/app/frontend/package.json`
- [x] Verification: Dialog "Nouvelle intervention" reste ouvert 75s+ sans reload

## Renommage specifications -> variants dans le Backend (18 Avril 2026)
- [x] Migration SQLite: table `product_specifications` -> `product_variants`, colonne `specification_id` -> `variant_id` sur `products` et `intervention_products` (backup cree: chrono_dmi.sqlite.bak.*)
- [x] Backend entites: `ProductSpecification` -> `ProductVariant` (reference.entities.ts, product.entity.ts, intervention.entity.ts, index.ts)
- [x] Backend services/controllers/modules: categories, products, instances, interventions, consumption, app.module, seed
- [x] Endpoints API: `/api/product-specifications` -> `/api/product-variants` (GET/POST/PUT/DELETE)
- [x] Query params: `specification_id` -> `variant_id` sur filter-options, fifo-suggestion, available-stock
- [x] Relations: `'specification'` -> `'variant'` dans les findOne/find (products, instances, interventions, consumption)
- [x] Enrichissement intervention: champ retourne `variant` (au lieu de `specification`), `resolution = 'variant'`
- [x] Frontend aligne sur la nouvelle API: products, interventions, cabinets, orders, picking, picking-libre
- [x] Tests agent: 100% backend (15/15) + frontend (Variantes tab, cascade, intervention detail, picking-libre)

## Next Steps (encore a faire)
1. (P1) Import CSV pour Commandes
2. (P1) Commande Reapprovisionnement
3. (P2) Socket.IO temps reel
4. (P2) Migration SQLite -> MSSQL
5. (P3) Integration cabinets physiques (hardware)

## Scanner GS1 et champ GTIN (17 Avril 2026)
- [x] Backend: Entite Product enrichie avec colonne `gtin` (varchar 14)
- [x] Backend: Parseur GS1 (`gs1-parser.util.ts`) extrait GTIN (AI 01), expiration (AI 17), lot (AI 10), serie (AI 21), variante (AI 20 ignoree)
- [x] Backend: `GET /api/products/by-gtin/:gtin` et `POST /api/products/scan`
- [x] Frontend: Colonne GTIN dans la table Produits + champ dans formulaire creation/modification (auto-parse)
- [x] Frontend: Dialog "Scanner GS1" avec auto-submit (pas besoin d'Enter)
- [x] Frontend: Restock + Picking Libre utilisent le parser GS1 pour extraire AI 10/21 automatiquement (tag LOT visible)

## Refonte module Commandes (17 Avril 2026)
- [x] Backend: Entite Order + colonne `order_number` (50 chars)
- [x] Backend: create() cree directement en statut 'sent' (saut de l'etape brouillon)
- [x] Backend: Nouvel endpoint POST /api/orders/:id/scan-receive (cree l'instance depuis le scan GS1)
- [x] Frontend: Dialog "Nouvelle commande" simplifie (fournisseur + N° commande uniquement)
- [x] Frontend: Apres creation, ouverture automatique du detail avec zone scanner GS1 focus
- [x] Frontend: Colonne "N° commande" dans la table
