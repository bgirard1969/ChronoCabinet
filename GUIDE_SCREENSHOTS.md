# Guide de Capture d'Ecran — Chrono DMI v2

## Objectif

Ce guide vous indique **exactement** quels screenshots prendre pour votre présentation.
Chrono DMI v2 a deux interfaces : **Client Lourd** (admin) et **Client Léger** (tactile).

---

## Préparation

### Comptes de test

| Interface | Identifiant | Authentification |
|---|---|---|
| Client Lourd | benoit.girard@atmshealth.com / Salut123 | Email + mot de passe |
| Client Léger | NIP : 1234 | Numpad tactile |

### Configuration recommandée
- Navigateur : Chrome ou Firefox
- Résolution : 1920x1080
- Format : PNG

---

## PARTIE 1 : Client Lourd (Administration)

### SCREENSHOT 1 : Page de connexion

**URL :** `/`

**A capturer :**
- Logo "Chrono DMI" avec choix Client Lourd / Client Léger
- Formulaire email + mot de passe

**Nom du fichier :** `01-login.png`

---

### SCREENSHOT 2 : Interventions — Tableau

**URL :** `/admin/interventions`

**A capturer :**
- Filtres rapides : Aujourd'hui / Cette semaine / Toutes / Période
- Tableau avec colonnes : Date/Heure, MRN, Date naissance, Produits, Statut
- Bouton "Nouvelle intervention"

**Nom du fichier :** `02-admin-interventions-tableau.png`

---

### SCREENSHOT 3 : Interventions — Calendrier plage de dates

**URL :** `/admin/interventions`

**Instructions :**
1. Cliquez sur le bouton "Période" (icone calendrier)
2. Le popover s'ouvre avec 2 mois

**A capturer :**
- Popover calendrier ouvert avec 2 mois côte à côte
- Dates sélectionnables

**Nom du fichier :** `03-admin-interventions-calendrier.png`

---

### SCREENSHOT 4 : Interventions — Création

**URL :** `/admin/interventions`

**Instructions :**
1. Cliquez "Nouvelle intervention"
2. Remplissez la date, le MRN, la date de naissance
3. Sélectionnez une catégorie dans les filtres en cascade

**A capturer :**
- Modal de création
- Champs : Date/Heure, MRN, Date naissance
- 3 colonnes de filtres cascadés : Catégorie / Modèle / Spécification
- Table de résultats produits avec bouton "+"

**Nom du fichier :** `04-admin-interventions-creation.png`

---

### SCREENSHOT 5 : Interventions — Détail et spécification progressive

**URL :** `/admin/interventions`

**Instructions :**
1. Cliquez sur une intervention existante
2. Le panneau détail s'ouvre

**A capturer :**
- En-tête avec date, MRN, date de naissance
- Liste des produits avec badges de résolution (Catégorie/Modèle/Produit)
- Bouton "Compléter" pour un produit partiellement spécifié
- Section "Ajouter un produit" avec filtres cascadés

**Nom du fichier :** `05-admin-interventions-detail.png`

---

### SCREENSHOT 6 : Cabinets — Matrice

**URL :** `/admin/cabinets`

**A capturer :**
- Liste des cabinets
- Vue matrice N×M d'un cabinet
- Badges d'expiration (vert/jaune/rouge)
- Barres de remplissage

**Nom du fichier :** `06-admin-cabinets.png`

---

### SCREENSHOT 7 : Produits — Vue onglets

**URL :** `/admin/products`

**A capturer :**
- 5 onglets visibles : Produits / Fournisseurs / Catégories / Modèles / Spécifications
- Tableau des produits
- Bouton d'ajout

**Nom du fichier :** `07-admin-produits.png`

---

### SCREENSHOT 8 : Commandes

**URL :** `/admin/orders`

**A capturer :**
- Tableau des commandes avec tri par colonne
- Statuts : Brouillon / Envoyée / Reçue

**Nom du fichier :** `08-admin-commandes.png`

---

### SCREENSHOT 9 : Consommation — Import Excel

**URL :** `/admin/consumption`

**Instructions :**
1. Uploadez un fichier Excel de consommation
2. Attendez le résultat du matching

**A capturer :**
- Zone d'upload
- Résultats : Trouvé / Non trouvé / A vérifier

**Nom du fichier :** `09-admin-consommation.png`

---

### SCREENSHOT 10 : Mouvements — Filtres et exports

**URL :** `/admin/movements`

**A capturer :**
- Filtres : recherche, N° série, N° lot, plage de dates (calendrier)
- Boutons Export Excel et Export PDF
- Tableau des mouvements avec colonnes triables

**Nom du fichier :** `10-admin-mouvements.png`

---

### SCREENSHOT 11 : Employés

**URL :** `/admin/employees`

**A capturer :**
- Tableau des employés
- Rôles, NIP, carte

**Nom du fichier :** `11-admin-employes.png`

---

## PARTIE 2 : Client Léger (Production)

### SCREENSHOT 12 : Login NIP

**URL :** `/light/login`

**A capturer :**
- Titre "Chrono DMI — Client Léger"
- Numpad avec grands boutons tactiles
- Onglets NIP / Carte
- Bouton "URGENCE" rouge

**Nom du fichier :** `12-light-login.png`

---

### SCREENSHOT 13 : Interventions du jour

**URL :** `/light/interventions`

**Instructions :**
1. Connectez-vous avec NIP 1234
2. Restez sur la date du jour

**A capturer :**
- Navigation par date (flèches ← Aujourd'hui →)
- 3 boutons : Mise en stock / PICKING / + Intervention
- Liste des interventions avec heure, MRN, date de naissance
- Bouton d'édition (crayon) sur chaque intervention

**Nom du fichier :** `13-light-interventions.png`

---

### SCREENSHOT 14 : Client Léger — Création intervention

**URL :** `/light/interventions`

**Instructions :**
1. Cliquez sur "+ Intervention"
2. La modal s'ouvre (thème sombre)

**A capturer :**
- Modal de création avec thème sombre
- Champs : Date/Heure, MRN, Date naissance
- 3 colonnes de filtres cascadés (thème sombre)
- Table de résultats produits

**Nom du fichier :** `14-light-creation-intervention.png`

---

### SCREENSHOT 15 : Picking FIFO

**URL :** `/light/picking/{id}` (cliquer sur une intervention)

**A capturer :**
- Description produit à gauche
- Localisation cabinet en grand à droite
- Badge quantité vert
- Sous-lignes par instance (N° série, date expiration, localisation)
- Bouton "Prélever" par instance

**Nom du fichier :** `15-light-picking-fifo.png`

---

### SCREENSHOT 16 : Picking Libre

**URL :** `/light/picking-libre`

**A capturer :**
- Filtres cascadés : Catégorie → Modèle → Spécification
- Champ scan N° de série
- Résultats avec bouton sélection
- Validation MRN + Date naissance

**Nom du fichier :** `16-light-picking-libre.png`

---

### SCREENSHOT 17 : Mise en stock

**URL :** `/light/restock`

**A capturer :**
- Interface de scan
- Flux de mise en stock (scan → détection → placement)

**Nom du fichier :** `17-light-mise-en-stock.png`

---

## Checklist finale

Vérifiez que vous avez :

**Client Lourd (11 screenshots) :**
- [ ] Page de connexion
- [ ] Interventions — tableau avec filtres
- [ ] Interventions — calendrier plage de dates ouvert
- [ ] Interventions — modal création avec filtres cascadés
- [ ] Interventions — panneau détail avec spécification progressive
- [ ] Cabinets — matrice N×M avec badges
- [ ] Produits — vue 5 onglets
- [ ] Commandes — tableau trié
- [ ] Consommation — import Excel avec résultats
- [ ] Mouvements — filtres + exports
- [ ] Employés — tableau

**Client Léger (6 screenshots) :**
- [ ] Login NIP
- [ ] Interventions du jour (3 boutons + liste)
- [ ] Création intervention (modal thème sombre)
- [ ] Picking FIFO
- [ ] Picking Libre
- [ ] Mise en stock

---

## Conseils

1. **Résolution :** 1920x1080 minimum
2. **Format :** PNG pour qualité optimale
3. **Données :** Assurez-vous d'avoir des interventions avec MRN et produits
4. **Thème :** Client Lourd = fond clair, Client Léger = fond sombre
5. **Ordre :** Prenez tous les screenshots Client Lourd d'abord, puis Client Léger
6. **Cohérence :** Utilisez la même session pour tous les screenshots

---

*Guide mis à jour le 13 avril 2026 — Chrono DMI v2*
