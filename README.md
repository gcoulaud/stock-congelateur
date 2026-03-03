# App Web Stock Congelateur

Application web simple pour suivre les produits restants dans les congelateurs.

## Fonctions

- Ajouter un produit avec quantite
- Choisir entre 2 congelateurs (liste separee pour chacun)
- Incrementer / decrementer la quantite
- Supprimer un produit
- Vider un congelateur individuellement
- Sauvegarde locale automatique (`localStorage`)
- Generation d'un QR code pour ouvrir l'application sur mobile

## Lancer en local

Comme c'est une app statique, tu peux ouvrir `index.html` directement dans ton navigateur.

Option serveur local (recommande):

```bash
cd /Users/yaume/Documents/Stock
python3 -m http.server 8080
```

Puis ouvrir: `http://localhost:8080`

## Hebergement cloud (simple)

### Netlify

1. Cree un depot Git avec ces fichiers
2. Connecte le depot a Netlify
3. Build command: vide
4. Publish directory: `.`

Tu obtiendras une URL publique du style `https://xxx.netlify.app`.

### Vercel

1. Cree un depot Git avec ces fichiers
2. Import dans Vercel
3. Framework preset: `Other`
4. Output directory: `.`

## QR code

Dans l'app:

1. Mets ton URL publique cloud
2. Clique sur `Generer QR`
3. Scanne le code avec ton telephone pour ouvrir l'app


## Mise a jour auto du navigateur

L'application verifie `version.json` toutes les 60 secondes.
Si la version change, la page se recharge automatiquement.

A chaque modification publiee, pense a mettre a jour la valeur `version` dans `version.json`.


## Mode partage foyer (cloud)

L'application peut synchroniser les stocks entre tous les telephones avec Firebase Firestore.

1. Cree un projet Firebase
2. Active Firestore Database (mode production ou test)
3. Dans Project settings > General > Your apps > Web app, recupere la configuration
4. Ouvre `app.js` et remplace les champs de `FIREBASE_CONFIG`
5. Redeploie sur GitHub Pages

Quand la configuration est correcte, l'etat affiche `Synchro cloud active`.
Sans configuration, l'app reste en mode local (chaque telephone a ses propres donnees).
