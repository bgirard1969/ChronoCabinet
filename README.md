# Chrono DMI v2

Système de traçabilité de dispositifs médicaux implantables (DMI) pour milieu hospitalier.

## Architecture

Application bi-client : **Client Lourd** (administration) et **Client Léger** (production tactile) partageant le même backend et synchronisés en temps réel via Socket.IO.

### Stack technique

| Composant | Technologie |
|---|---|
| Frontend | React 18 + Tailwind CSS + shadcn/ui + Lucide React |
| Backend | FastAPI + Motor (MongoDB async) |
| Base de données | MongoDB |
| Temps réel | Socket.IO (python-socketio + socket.io-client) |
| Auth | JWT + bcrypt (NIP, email/mot de passe, carte employé) |
| Excel | openpyxl (backend) |
| Calendrier | react-day-picker + date-fns (locale fr) |

### Structure du projet

```
/app/
├── backend/
│   ├── server.py                # FastAPI app + Socket.IO mount
│   ├── sio.py                   # Socket.IO server instance
│   ├── models.py                # Pydantic models + enums
│   └── routes/
│       ├── auth.py              # JWT login (email, PIN, carte)
│       ├── suppliers.py         # CRUD fournisseurs
│       ├── categories_types.py  # Catégories + Types + Spécifications
│       ├── cabinets.py          # Cabinets + emplacements (matrice N×M)
│       ├── products.py          # Produits + filter-options (cascade)
│       ├── instances.py         # ProductInstances (cycle de vie)
│       ├── orders.py            # Commandes d'achat
│       ├── interventions.py     # Interventions + produits (spec. progressive)
│       ├── consumption.py       # Import Excel consommation
│       ├── employees.py         # CRUD employés
│       ├── movements.py         # Journal d'audit + exports PDF/Excel
│       └── hardware.py          # Stubs hardware (Phase 5)
│
├── frontend/src/
│   ├── App.js                   # Routeur principal (admin/* + light/*)
│   ├── components/
│   │   ├── ui/                  # Composants shadcn (Calendar, Popover, etc.)
│   │   └── interventions/       # Composants partagés refactorisés
│   │       ├── useStockBrowser.js
│   │       ├── interventionHelpers.js
│   │       ├── CascadingFilters.jsx
│   │       ├── StockResultsTable.jsx
│   │       └── InterventionFormFields.jsx
│   ├── pages/admin/             # Client Lourd
│   │   ├── AdminLayout.js       # Sidebar + routing
│   │   ├── Interventions.js
│   │   ├── Cabinets.js
│   │   ├── Products.js          # 5 onglets
│   │   ├── Orders.js
│   │   ├── Consumption.js
│   │   ├── Employees.js
│   │   └── Movements.js
│   └── pages/light/             # Client Léger
│       ├── Login.js             # NIP + carte + urgence
│       ├── Interventions.js
│       ├── Picking.js
│       ├── PickingLibre.js
│       └── Restock.js
│
├── PLAN_REFONTE_V2.md           # Architecture détaillée + migration NestJS
├── PRESENTATION_CHRONO_DMI.md   # Slides de présentation
└── GUIDE_SCREENSHOTS.md         # Guide de capture d'écran
```

## Fonctionnalités principales

### Client Lourd (Administration)
- **Interventions** — Tableau filtrable + calendrier plage de dates + CRUD + spécification progressive
- **Cabinets** — Matrice N×M interactive avec badges d'expiration
- **Produits** — 5 onglets (Produits, Fournisseurs, Catégories, Modèles, Spécifications)
- **Commandes** — Workflow brouillon → envoi → réception + export GRM
- **Consommation** — Import Excel avec matching MRN/Description/SN/Lot
- **Employés** — CRUD avec rôles, NIP, carte
- **Mouvements** — Filtres avancés + export PDF/Excel

### Client Léger (Production tactile)
- **Interventions du jour** — Navigation par date + création/édition
- **Picking FIFO** — Prélèvement par intervention avec suggestions FIFO
- **Picking Libre** — Prélèvement hors intervention avec filtres cascadés
- **Mise en stock** — Réapprovisionnement + remise en stock unifiés

### Concepts clés
- **MRN** — Identifiant patient (remplace "Dossier patient")
- **Date de naissance** — Champ complémentaire (format AAAA-MM-JJ)
- **Spécification progressive** — Ajouter un produit à n'importe quel niveau (Catégorie → Modèle → Spec → Produit)
- **ProductStatus** — Cycle de vie : ORDERED → RECEIVED → PLACED → PICKED → CONSUMED → INVOICED
- **Fuseau horaire** — America/Toronto (Eastern Time)

## Démarrage

### Prérequis
- Node.js 18+
- Python 3.11+
- MongoDB 6+

### Installation

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
yarn install
```

### Variables d'environnement

**backend/.env :**
```
MONGO_URL=mongodb://...
DB_NAME=chrono_dmi
JWT_SECRET=...
```

**frontend/.env :**
```
REACT_APP_BACKEND_URL=https://...
```

### Lancement

```bash
# Backend (port 8001)
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 3000)
cd frontend && yarn start
```

## Comptes de test

| Rôle | Email | Mot de passe | NIP |
|---|---|---|---|
| Administrateur | benoit.girard@atmshealth.com | Salut123 | 1234 |
| Clinicien | clinicien@atmshealth.com | Clinicien123 | — |

## Documentation

- **PLAN_REFONTE_V2.md** — Architecture détaillée, modèle de données, plan de migration NestJS/Angular/MSSQL
- **PRESENTATION_CHRONO_DMI.md** — Slides de présentation pour les parties prenantes
- **GUIDE_SCREENSHOTS.md** — Instructions pour capturer les screenshots de l'application

---

*ATMSHEALTH - Chrono DMI v2 — Mis à jour le 13 avril 2026*
