# Capocantiere negli store

L'app è una PWA installabile (manifest, icone 192/512/maskable, service worker). Questo file dice cosa è già pronto e cosa resta da fare a mano.

## Già pronto

- Manifest e icone: `public/manifest.webmanifest`, `public/icon-*.png`, `public/apple-touch-icon.png`.
- Account, informativa privacy (`/privacy`) e termini (`/termini`) raggiungibili senza accesso.
- Cancellazione dell'account e dei dati dall'app (Account → Cancella account e dati): richiesta da Apple e Google.
- Esportazione/ripristino dei dati (portabilità, GDPR).
- Avvisi di sicurezza sui mestieri a rischio e dichiarazione "stima indicativa" nei preventivi.
- Nessuna pubblicità, nessun tracciamento; unico cookie: sessione.

## Da fare prima di pubblicare

1. **HTTPS e dominio stabile** (Railway lo fornisce). Imposta `VITE_CONTACT_EMAIL` con un'email reale prima della build: compare in privacy e termini.
2. **Titolare del trattamento**: completa l'informativa con ragione sociale, indirizzo e P. IVA del gestore (richiesto per l'App Store).
3. **Database persistente**: su Railway aggiungi un Volume montato su `/data` e imposta `DATA_DIR=/data`, altrimenti i dati si perdono a ogni deploy.
4. **Registrazione**: per gli store gli utenti devono potersi iscrivere da soli. Con `INVITE_CODE` impostato serve il codice; per un lancio pubblico togli `INVITE_CODE` e imposta `SIGNUP_OPEN=true`, tieni attivi i limiti giornalieri (`AI_DAILY_LIMIT`, ecc.) e `MONTHLY_BUDGET_USD`.
5. **Prova e abbonamento**: ogni nuovo account ha 7 giorni di prova con tutto incluso (`TRIAL_DAYS`), poi si bloccano creazione di lavori e AI (i dati restano leggibili ed esportabili). Per attivare il pagamento a 4,99 €/mese crea su Stripe un *Prodotto* con prezzo ricorrente mensile di 4,99 EUR, poi su Railway imposta `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `APP_URL` e `STRIPE_WEBHOOK_SECRET` (webhook verso `/api/billing/webhook` per gli eventi `checkout.session.completed` e `customer.subscription.created/updated/deleted`). Senza queste variabili il pulsante di pagamento non compare e l'amministratore può sbloccare a mano da `POST /api/admin/subscription`. Gli account in `UNLIMITED_EMAILS` e l'amministratore non sono soggetti al blocco.
6. **Recupero password**: attivo. Per l'invio automatico via email imposta `RESEND_API_KEY` (e `MAIL_FROM` con un dominio verificato); senza, l'amministratore genera il link dal pannello Amministrazione. La verifica dell'email in fase di iscrizione non c'è ancora.
7. **Schede store**: screenshot, descrizione, categoria, età minima, dichiarazione dei dati raccolti (Apple "Privacy nutrition label", Google "Data safety": email, foto, contenuti utente; condivisi con OpenAI per l'elaborazione).

## Google Play (il percorso più rapido)

Trusted Web Activity con Bubblewrap:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://TUO-DOMINIO/manifest.webmanifest
bubblewrap build
```

Il file di partenza è `play/twa-manifest.json` (copialo nella cartella di lavoro di Bubblewrap e cambia `packageId` se vuoi). Serve un account Google Play Developer (25 USD una tantum).

`assetlinks.json` lo genera il server da solo: dopo `bubblewrap build` (o dalla Play Console → Integrità dell'app) prendi l'impronta SHA-256 della chiave di firma e imposta su Railway `ANDROID_PACKAGE` e `ANDROID_SHA256` (più impronte separate da virgola). Poi controlla `https://TUO-DOMINIO/.well-known/assetlinks.json`: senza quel file l'app mostra la barra del browser.

### Pagamenti dentro l'app su Google Play (importante)

Le regole di Google Play impongono **Google Play Billing** per sbloccare funzioni digitali *dentro* l'app Android. L'abbonamento con Stripe funziona sul sito e nella PWA; nell'app pubblicata su Play può essere contestato. Opzioni:

1. Pubblicare l'app Play come strumento che richiede un account già abbonato dal sito (senza pulsante di pagamento dentro l'app) e dichiararlo nella scheda;
2. Oppure aggiungere Play Billing (API Digital Goods con la TWA) e collegarlo a `POST /api/admin/subscription` o a un nuovo endpoint che verifica l'acquisto con la Google Play Developer API. Non è ancora implementato: richiede il tuo account Play e un service account.

## App Store (iOS)

Apple non accetta una semplice PWA: serve un'app nativa che incapsuli il sito, ad esempio con Capacitor:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Capocantiere it.tuodominio.capocantiere --web-dir dist
npx cap add ios
```

Occorrono un Mac con Xcode e l'Apple Developer Program (99 USD/anno). Apple tende a respingere app che sono solo un sito web: aggiungi funzioni native utili (fotocamera diretta, condivisione, notifiche).

## Limiti noti

- Offline: l'app si apre e i lavori già caricati si leggono e si modificano; le modifiche si sincronizzano al ritorno della rete. Le funzioni AI e i video richiedono la rete.
- Le foto per l'analisi AI passano da OpenAI: dillo chiaramente nella scheda store.
