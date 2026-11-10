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
4. **Registrazione**: per gli store gli utenti devono potersi iscrivere da soli. Con `INVITE_CODE` impostato serve il codice; per un lancio pubblico imposta `SIGNUP_OPEN=true` e tieni attivi i limiti giornalieri (`AI_DAILY_LIMIT`, ecc.) per contenere il costo OpenAI. Valuta un abbonamento o crediti per coprire i costi.
5. **Recupero password**: attivo. Per l'invio automatico via email imposta `RESEND_API_KEY` (e `MAIL_FROM` con un dominio verificato); senza, l'amministratore genera il link dal pannello Amministrazione. La verifica dell'email in fase di iscrizione non c'è ancora.
6. **Schede store**: screenshot, descrizione, categoria, età minima, dichiarazione dei dati raccolti (Apple "Privacy nutrition label", Google "Data safety": email, foto, contenuti utente; condivisi con OpenAI per l'elaborazione).

## Google Play (il percorso più rapido)

Trusted Web Activity con Bubblewrap:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://TUO-DOMINIO/manifest.webmanifest
bubblewrap build
```

Serve un account Google Play Developer (25 USD una tantum) e il file `assetlinks.json` su `/.well-known/` con l'impronta della chiave di firma.

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
