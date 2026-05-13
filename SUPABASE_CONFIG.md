# Configuration Supabase — Redirection email

Le lien de confirmation dans les emails Supabase redirige vers `localhost:3000`
parce que l'URL du site n'est pas encore déclarée dans votre dashboard Supabase.

## Étapes à faire UNE SEULE FOIS dans le dashboard Supabase

### 1. Site URL (URL principale)

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **Authentication** → **URL Configuration**
4. Dans le champ **Site URL**, remplacer `http://localhost:3000` par :
   ```
   https://chiikaa.netlify.app
   ```
5. Cliquer **Save**

### 2. Redirect URLs (URLs autorisées)

Dans la même page **URL Configuration**, section **Redirect URLs** :

Ajouter ces deux entrées :
```
https://chiikaa.netlify.app
https://chiikaa.netlify.app/**
```

Cliquer **Add URL** pour chacune, puis **Save**.

---

## Ce que fait cette configuration

- **Site URL** : URL vers laquelle Supabase redirige après confirmation d'email
- **Redirect URLs** : liste blanche des URLs autorisées comme destination de redirection
  (Supabase refuse les redirections vers des URLs non listées par sécurité)

## Vérification

Après configuration :
1. Créer un nouveau compte sur https://chiikaa.netlify.app
2. Ouvrir l'email de confirmation
3. Cliquer le lien → vous devez arriver sur **https://chiikaa.netlify.app** (et non localhost)

---

> **Note :** Le code envoie déjà `emailRedirectTo: 'https://chiikaa.netlify.app'`
> dans la requête d'inscription. La configuration Supabase est nécessaire en plus
> car Supabase valide que l'URL est dans la liste blanche avant d'accepter la redirection.
