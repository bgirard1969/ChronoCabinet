# Chrono DMI v2
## Système de traçabilité de dispositifs médicaux implantables

---

## SLIDE 1 : Page Titre

### Chrono DMI v2
**Système de traçabilité de dispositifs médicaux implantables**

- Architecture bi-client : Client Lourd (admin) + Client Léger (tactile)
- Traçabilité complète du GRM au patient via MRN
- FIFO automatique et spécification progressive
- Temps réel via Socket.IO

---

## SLIDE 2 : Architecture bi-client

### Deux interfaces, un seul système

**Client Lourd (Administration)**
- Accès : Email + mot de passe
- Utilisateurs : Gestionnaires, Administrateurs
- Modules : Interventions, Cabinets, Produits, Commandes, Consommation, Employés, Mouvements

**Client Léger (Production)**
- Accès : NIP tactile ou scan carte employé
- Utilisateurs : Cliniciens, Gestionnaires
- Modules : Interventions du jour, Picking FIFO, Picking Libre, Mise en stock

**Communication temps réel** : Socket.IO synchronise automatiquement les deux clients

---

## SLIDE 3 : Client Lourd — Interventions

### Planification et suivi

**Tableau filtrable :**
- Filtres rapides : Aujourd'hui / Cette semaine / Toutes
- Calendrier de plage de dates (popover 2 mois, locale française)
- Colonnes : Date/Heure, MRN, Date naissance, Produits, Statut

**Fonctionnalités :**
- Création d'intervention avec formulaire et produits requis
- Panneau détail avec gestion des produits (ajouter, modifier quantité, supprimer)
- Spécification progressive (Catégorie → Modèle → Spécification → Produit)
- Modification et suppression d'intervention

---

## SLIDE 4 : Spécification Progressive

### Ajout de produits à n'importe quel niveau de précision

**Niveaux de résolution :**
1. **Catégorie** (ex: "Vis") — le plus large
2. **Modèle** (ex: "Vis corticale")
3. **Spécification** (ex: "5.0mm")
4. **Produit exact** (ex: "Vis corticale 5.0mm x 30mm")

**Interface en 3 colonnes cascadées :**
- Sélection de catégorie filtre les modèles disponibles
- Sélection de modèle filtre les spécifications
- Possibilité d'ajouter à n'importe quel niveau

**Complétion progressive :**
- Un produit ajouté au niveau "Catégorie" peut être complété ultérieurement
- Badge de résolution : Catégorie / Modèle / Spec / Produit / Instance

---

## SLIDE 5 : Client Lourd — Cabinets

### Gestion des armoires physiques

**Vue matrice N×M interactive :**
- Visualisation grille avec occupation
- Badges d'expiration (vert/jaune/rouge)
- Tooltips avec détails produit
- Barres de remplissage par cabinet

**Configuration :**
- Création de cabinets (description, dimensions)
- Association produit/emplacement
- Gestion du placement physique

---

## SLIDE 6 : Client Lourd — Produits

### Catalogue complet en 5 onglets

**Onglets :**
1. **Produits** — Tableau complet avec CRUD
2. **Fournisseurs** — Gestion fournisseurs (nom, contact, tel, email)
3. **Catégories** — Types de produits (Vis, Plaque, etc.)
4. **Modèles** — Sous-types (Vis corticale, Vis spongieuse, etc.)
5. **Spécifications** — Dimensions/variantes (5.0mm, 14x5, etc.)

**Formulaire produit (ordre optimisé) :**
Description → Catégorie → Modèle → Spécification → GRM → Fournisseur

---

## SLIDE 7 : Client Lourd — Commandes

### Workflow complet de commande

**Cycle de vie :**
1. **Brouillon** — Création avec sélection produits/quantités
2. **Envoyée** — Verrouillage, date d'envoi enregistrée
3. **Réception** — Assignation N° série, lot, date expiration

**Fonctionnalités :**
- Tri par colonne (date d'envoi descendant par défaut)
- Export GRM (fichier pipe-delimited, fuseau America/Toronto)
- Commandes de remplacement automatiques par fournisseur à l'export

---

## SLIDE 8 : Client Lourd — Consommation

### Import Excel quotidien

**Workflow :**
1. Upload du fichier Excel (.xlsx) de consommation journalière
2. Parsing automatique (openpyxl)
3. Matching : MRN + Description + N° Série/Lot

**Résultats de matching :**
- **Trouvé** — Correspondance exacte dans le système
- **Non trouvé** — Aucune correspondance (à vérifier manuellement)
- **À vérifier** — Correspondance partielle (vérification manuelle requise)

---

## SLIDE 9 : Client Lourd — Mouvements

### Journal d'audit complet

**Filtres avancés :**
- Recherche texte libre
- Scanner N° de série / N° de lot (champs dédiés)
- Plage de dates (calendrier popover avec sélection de période)

**Fonctionnalités :**
- Tri par colonne
- Export Excel (respecte les filtres actifs)
- Export PDF (respecte les filtres actifs)
- Colonne "Détail" (remplace l'ancien "Raison")

---

## SLIDE 10 : Client Léger — Login

### Accès rapide pour la production

**Modes d'authentification :**
1. **NIP** — Grands boutons numériques tactiles
2. **Carte employé** — Scan de badge
3. **Urgence** — Accès rapide en situation d'urgence

**Interface optimisée tactile :**
- Thème sombre pour réduire la fatigue visuelle
- Boutons grands et espacés
- Feedback visuel immédiat

---

## SLIDE 11 : Client Léger — Interventions du jour

### Vue quotidienne simplifiée

**Navigation par date :**
- Flèches ← / → pour naviguer entre les jours
- Bouton "Aujourd'hui" pour revenir au jour courant
- Sélecteur de date pour accès direct

**Informations affichées par intervention :**
- Heure planifiée
- MRN + Date de naissance
- Nombre de produits requis
- Accès direct au picking (clic sur l'intervention)

**Actions gestionnaire :**
- Mise en stock | PICKING | + Intervention (3 boutons rapides)
- Modification et suppression d'intervention

---

## SLIDE 12 : Client Léger — Picking FIFO

### Prélèvement optimisé par intervention

**Interface :**
- Description produit à gauche, localisation cabinet en grand à droite
- Badge quantité vert
- Sous-lignes par instance : N° série, date expiration, localisation
- Bouton "Prélever" individuel par instance

**Fonctionnalités :**
- Suggestion FIFO automatique (date expiration la plus proche)
- Bouton refresh pour nouvelles suggestions
- Édition en place (modifier quantité, MRN)
- Ajout dynamique de produits avec filtres en cascade

---

## SLIDE 13 : Client Léger — Picking Libre

### Prélèvement hors intervention

**Workflow :**
1. Filtres cascadés : Catégorie → Modèle → Spécification
2. Sélection produit dans les résultats
3. Scan N° de série pour confirmer
4. Saisie MRN + Date de naissance patient

**Caractéristiques :**
- Scan direct N° de série (champ dédié)
- Validation FIFO automatique
- Traçabilité complète

---

## SLIDE 14 : Client Léger — Mise en stock

### Flux unifié de mise en stock

**Deux cas d'usage :**
1. **Réapprovisionnement** — Nouveau produit reçu → placement cabinet
2. **Remise en stock** — Produit prélevé non utilisé → retour cabinet

**Workflow :**
- Scan N° de série
- Auto-détection (nouveau ou existant)
- Suggestion d'emplacement
- Confirmation de placement

---

## SLIDE 15 : Identifiant Patient (MRN)

### Traçabilité patient modernisée

**MRN (Medical Record Number) :**
- Remplace l'ancien "Dossier patient"
- Présent dans : Interventions, Picking, Picking Libre, Mouvements
- Format libre (champ texte)

**Date de naissance :**
- Nouveau champ complémentaire au MRN
- Format AAAA-MM-JJ
- Affiché dans : Interventions (tableau + détail), Picking, Picking Libre

---

## SLIDE 16 : Exports

### PDF et Excel

**Mouvements :**
- Export Excel (.xlsx) — Respecte tous les filtres actifs
- Export PDF — Respecte tous les filtres actifs
- Données : Date, Produit, Détail, N° Série, N° Lot, Type, Quantité

**Commandes :**
- Export GRM (fichier pipe-delimited)
- Fuseau horaire : America/Toronto (Eastern Time)
- Commandes de remplacement auto-générées

---

## SLIDE 17 : Temps réel (Socket.IO)

### Synchronisation automatique

**Événements :**
| Événement | Déclencheur | Effet |
|---|---|---|
| `intervention_changed` | Création/modification/picking | Rafraîchit listes interventions |
| `inventory_changed` | Placement/prélèvement/retour | Rafraîchit stock |

**Avantage :**
- Client Lourd et Client Léger toujours synchronisés
- Pas de rafraîchissement manuel nécessaire
- Données à jour en temps réel

---

## SLIDE 18 : Sécurité et Rôles

### Contrôle d'accès par rôle

| Rôle | Client Lourd | Client Léger |
|---|---|---|
| Administrateur | Accès complet | Accès complet + gestion |
| Gestionnaire | Accès complet | Accès complet + gestion |
| Technicien | — | Picking + Mise en stock |
| Clinicien | — | Interventions + Picking |
| Lecture | Consultation seule | — |

**Authentification :**
- JWT (email/mot de passe) pour Client Lourd
- NIP ou carte pour Client Léger

---

## SLIDE 19 : Stack Technique

### Architecture actuelle (Prototype)

| Composant | Technologie |
|---|---|
| Frontend | React + Tailwind CSS + Lucide React + shadcn/ui |
| Backend | FastAPI + Motor (MongoDB async) |
| Base de données | MongoDB |
| Temps réel | Socket.IO (python-socketio) |
| Auth | JWT + bcrypt (NIP, email/pwd, carte) |
| Fuseau horaire | America/Toronto (Eastern Time) |
| Excel parsing | openpyxl |
| Calendrier | react-day-picker + date-fns (locale fr) |

### Stack cible (Production)
| Composant | Technologie |
|---|---|
| Frontend | Angular 17+ + PrimeNG |
| Backend | NestJS + TypeORM |
| Base de données | MSSQL (SQL Server) |
| Temps réel | Socket.IO (@nestjs/websockets) |

---

## SLIDE 20 : Roadmap

### Prochaines étapes

**Phase 5 — Intégration Hardware (P2) :**
- Verrous d'armoires connectés
- LEDs d'emplacement (guidage visuel)
- Détecteurs de présence produit
- WebSocket pour événements capteurs

**Phase 6 — Migration Production (P3) :**
- Angular + NestJS + MSSQL
- Architecture documentée et prête
- Schéma TypeORM complet

---

## SLIDE 21 : Points clés

### Ce qui rend Chrono DMI v2 unique

1. **Bi-client** — Admin et tactile dans une seule application
2. **Spécification progressive** — Ajout de produits à n'importe quel niveau
3. **FIFO automatique** — Suggestions basées sur la date d'expiration
4. **MRN + Date naissance** — Traçabilité patient modernisée
5. **Import consommation Excel** — Matching automatique
6. **Exports PDF/Excel** — Avec filtres actifs
7. **Temps réel** — Socket.IO synchronise les deux clients
8. **Filtres avancés** — Calendrier de plage de dates, tri colonnes

---

## SLIDE 22 : Conclusion

### Chrono DMI v2 : La solution complète

**Une plateforme moderne pour :**
- Gérer efficacement vos DMI avec traçabilité GRM → Patient
- Assurer la conformité FIFO automatiquement
- Optimiser les stocks avec imports Excel et exports PDF
- Accélérer les opérations avec l'interface tactile
- Préparer l'avenir avec l'intégration hardware

**Contact :**
- Email : support@atmshealth.com

---

*Présentation mise à jour le 13 avril 2026 — Chrono DMI v2*
