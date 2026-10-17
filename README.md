# MaCaz — appli familiale privée (MVP)

Liste de courses partagée en temps réel, chat avec notifications push, agenda partagé et coffre à papiers (PDF + rappels d'expiration), pour deux personnes.
Stack : Expo SDK 57 (React Native 0.86, Expo Router, TypeScript) · Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions) · Expo Push (FCM).

### Papiers (étape 3)
- Photos (appareil photo ou galerie) réunies en **un seul PDF** sur le téléphone, ou PDF importé tel quel. Rangés dans un bucket Storage **privé** (`documents`), accessible uniquement aux deux membres de la caz.
- Onglet verrouillé par empreinte / visage / code du téléphone, reverrouillé dès que l'appli passe en arrière-plan.
- Rappels d'expiration (6 mois, 3 mois, 1 mois, 1 semaine, jour J au choix) : notification locale à 9 h sur les deux téléphones, carte dans le chat, et événement « Renouveler : … » dans l'agenda (optionnel).
- Après la mise à jour : exécuter `supabase/migrations/005_documents.sql`, puis **refaire un build** (`npm run build:dev` / `npm run build:apk`) : de nouveaux modules natifs sont utilisés (appareil photo, empreinte, fichiers).

---

## 1. Supabase (10 min)

1. Crée un projet sur supabase.com (offre gratuite).
2. **Authentication › Sign In / Providers › Email** : désactive « Confirm email » (plus simple pour 2 comptes). Si tu le laisses actif, l'appli affiche « Ouvre le lien reçu par email » après l'inscription.
3. **SQL Editor › New query** : colle tout `supabase/schema.sql`, puis **Run**. Recommence avec chaque fichier de `supabase/migrations/` dans l'ordre (`002_agenda.sql`…). Tous les scripts peuvent être relancés sans casse.
4. **Project Settings › API Keys** : note l'URL du projet et la clé **publishable** (`sb_publishable_…`, ou l'ancienne clé `anon`). Ne mets jamais la clé secrète / `service_role` dans l'appli.
5. **Realtime › Settings** : si tu actives « Private channels only », rien ne change pour l'appli. Le canal de présence est déjà privé et protégé par RLS.

## 2. Configuration du projet

```powershell
npm install
copy .env.example .env      # puis remplis EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_KEY
```

Mets les **mêmes deux valeurs** dans `eas.json` (bloc `build.base.env`) : les builds EAS se font dans le cloud et ne lisent pas ton `.env`.

À personnaliser dans `app.config.ts` :
- `ANDROID_PACKAGE` : identifiant de l'appli. Il doit être identique à celui déclaré dans Firebase.
- `EAS_PROJECT_ID` : à remplir à l'étape 3.
- Icônes : remplace les images de `assets/images/` (icône, icône adaptative Android, splash).

## 3. Lancer l'appli sur ton téléphone Android depuis Windows

L'appli utilise des modules natifs (notifications, clavier). **Expo Go ne suffit pas** : il faut un *development build*, c'est-à-dire ton propre « Expo Go » installé une fois sur le téléphone.

### a. Compte Expo + projet EAS (gratuit)

```powershell
npx eas-cli@latest login
npx eas-cli@latest init          # affiche un projectId → colle-le dans EAS_PROJECT_ID (app.config.ts)
```

### b. Firebase, pour le push Android

Expo Push passe par FCM sur Android, donc il faut un projet Firebase (offre Spark gratuite, sans carte bancaire).

1. console.firebase.google.com › Ajouter un projet (Analytics inutile).
2. Ajouter une appli **Android** avec le même nom de package que `ANDROID_PACKAGE`.
3. Télécharge `google-services.json` et place-le **à la racine du projet**.
4. Paramètres du projet › Comptes de service › **Générer une nouvelle clé privée** (fichier JSON, à garder secret).
5. Importe cette clé dans EAS : `npx eas-cli@latest credentials` › Android › (n'importe quel profil) › Google Service Account › **FCM V1** › sélectionne le fichier JSON.

### c. Build de développement (cloud, ~10-15 min)

```powershell
npm run build:dev
```

À la fin, EAS affiche un lien et un QR code. Ouvre-le sur le téléphone et installe l'APK (autorise « sources inconnues » pour ton navigateur). Ce build n'est à refaire que si tu ajoutes un module natif.

### d. Développer au quotidien

```powershell
npm start            # Metro en mode dev-client ; ouvre l'appli « MaCaz » sur le téléphone
npm start -- --tunnel   # si le PC et le téléphone ne sont pas sur le même Wi-Fi
```

Les modifications de code s'affichent instantanément sur le téléphone.

> Alternative 100 % locale : installe Android Studio (SDK + JDK 17), branche le téléphone en USB avec le débogage activé, puis `npm run android`. Cela compile sur ton PC, sans EAS.

## 4. Notifications push (Edge Function)

```powershell
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase secrets set WEBHOOK_SECRET=<une-longue-chaine-aleatoire>
npx supabase functions deploy notify --no-verify-jwt
```

Ensuite, dans Supabase : **Database › Webhooks › Create a new hook**
- Table : `messages`, événement : **Insert**
- Type : **Supabase Edge Functions** › `notify` › méthode POST
- En-tête HTTP : `x-webhook-secret` = la même chaîne que ci-dessus

Ce qui est notifié : chaque message du chat, chaque nouvel événement de l'agenda, et le premier article d'une série d'ajouts à la liste. Les ajouts suivants (< 15 min) sont regroupés dans la même carte du chat, sans renvoyer de notification. Toucher une notification ouvre le chat, la liste ou l’agenda au bon jour. Si tu es déjà sur l'écran Chat, aucune bannière ne s'affiche.

## 5. Premier lancement

1. Téléphone 1 : **Créer un compte** › prénom › **Créer notre foyer**. Un code à 6 caractères s'affiche sur l'accueil.
2. Téléphone 2 : **Créer un compte** › **J'ai un code** › prénom + code.
3. Le foyer est complet (2 membres maximum). Le premier est en bleu, le second en orange.

## 6. APK « de tous les jours »

```powershell
npm run build:apk     # profil preview : APK autonome, sans serveur de dev
```

Installe-le sur les deux téléphones à la place du build de dev, ou à côté si tu changes le package. Pour les mises à jour, refais un build et réinstalle par-dessus : les données restent dans Supabase. Firebase App Distribution peut envoyer l'APK aux deux téléphones si tu veux automatiser.

## 7. Sauvegarde (Supabase gratuit = pas de sauvegarde automatique)

Installe les outils clients PostgreSQL (`pg_dump`). Récupère la chaîne de connexion dans **Connect › Session pooler**, puis lance :

```powershell
pg_dump "postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres" --schema=public --data-only -f sauvegarde-foyer.sql
```

Le projet gratuit se met en pause après 7 jours sans activité. Une utilisation quotidienne suffit à l'éviter.

---

## Structure

```
src/
  app/                       routes Expo Router
    _layout.tsx              polices, providers, routes protégées (connexion → foyer → onglets)
    connexion.tsx            email + mot de passe
    foyer-setup.tsx          créer le foyer / rejoindre avec un code
    reglages.tsx             (modale) Réglages : caz, options du chat, notifications, compte
    evenement.tsx            (modale) création / modification d'un événement
    papier.tsx               fiche d'un papier (aperçu, échéance, rappels, ouvrir / partager le PDF)
    papier-edition.tsx       (modale) ajout / modification d'un papier (photos → PDF)
    (tabs)/                  accueil, courses, chat, agenda, documents
  components/                ui.tsx (boutons, cartes, champs…), Avatar, TabBar, DocLock (verrou papiers)…
  providers/                 Auth, Household, Shopping, Chat, Events, Documents (état + temps réel)
  lib/                       supabase, notifications, catégories d'articles, dates, types BDD
  theme/                     couleurs, typo, espacements (planche « Système visuel »)
supabase/
  schema.sql                 tables, RLS, RPC create/join, triggers, temps réel
  migrations/002_agenda.sql  table events, RLS, carte « ajouté à l'agenda » dans le chat
  migrations/003_chat_delete.sql  suppression dans le chat
  migrations/004_reglages.sql     réglages communs (cartes courses / agenda dans le chat)
  migrations/005_documents.sql    papiers : table, bucket Storage privé, alertes d'expiration
  functions/notify/          Edge Function Expo Push
```

### Sécurité (RLS)
- Chaque table est limitée au foyer de l'utilisateur, via `my_household_id()`.
- On ne crée ou ne rejoint un foyer que par les RPC `create_household` et `join_household` (2 membres maximum).
- Un membre ne peut modifier que son prénom, son jeton push et son « lu jusqu'à ». Sa couleur et son foyer sont verrouillés.
- `added_by` et `checked_by` sont posés côté serveur. Un message ne peut être envoyé qu'en son propre nom.
- Présence / « écrit… » : canal Realtime privé `household:<id>` protégé par RLS.
- Fichiers des papiers : rangés sous `<id de la caz>/…` dans un bucket privé ; les politiques Storage refusent tout autre dossier. Liens signés de courte durée (60 s pour un PDF, 1 h pour une miniature).

### Commandes utiles
`npm run typecheck` · `npm run lint` · `npx expo-doctor`

### Types de la base
Ils sont écrits à la main dans `src/lib/database.types.ts`. Pour les régénérer :
`npx supabase gen types typescript --linked > src/lib/database.types.ts`, puis remets les alias exportés en bas du fichier (`Household`, `Member`, `ShoppingItem`, `Message`, `MemberColor`).
