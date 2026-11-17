# Capocantiere — pacchetto per Google Play Console

Nuova app: **Crea app** → nome, lingua predefinita Italiano, App (non gioco), Gratuita con acquisti/abbonamento.

## Dati tecnici
- Package: `app.capocantiere.twa` (non modificabile dopo la pubblicazione)
- Sito: https://capocantiere-production.up.railway.app
- Icona 512: `public/icon-512.png` — Categoria: **Edilizia e casa** (alternativa: Strumenti)
- Contatto: la tua email reale · Privacy: `/privacy` del sito · Eliminazione account: Account → Cancella account e dati (indica questo URL: `/account`)

## Prezzi (da inserire in Monetizzazione → Prodotti → Abbonamenti)
- ID prodotto: `capocantiere_mensile` · Piano base `mensile`, rinnovo mensile automatico
- **4,99 EUR / mese** (Play converte negli altri paesi; controlla che nei paesi UE il prezzo includa l'IVA)
- Offerta: **prova gratuita 7 giorni** per i nuovi abbonati

## Scheda — Italiano
**Titolo (30):** Capocantiere
**Breve (80):** Foto del lavoro di casa: materiali, costi, preventivo e passi guidati.
**Completa:**
Capocantiere è l'assistente per i lavori di casa. Scatta una foto del problema: l'app riconosce il mestiere (muratore, idraulico, elettricista, imbianchino, piastrellista, falegname e altri), stima materiali e quantità, calcola il costo con i listini del tuo paese e prepara un preventivo da condividere in PDF.

• Diagnosi dalle foto con intelligenza artificiale
• Passi guidati fase per fase, con controllo del risultato dalla foto
• Preventivi numerati, cantieri, stati (bozza, inviato, accettato)
• Archivio dei tuoi lavori e preventivi, con esportazione CSV
• Listini per Italia, Paesi Bassi, Germania, Spagna e Belgio
• Italiano, English, Español
• Funziona anche con rete scarsa: le modifiche si sincronizzano dopo

7 giorni di prova gratuita con tutto incluso, poi 4,99 € al mese. Le stime sono indicative: per lavori su gas, elettrico o strutture rivolgiti a un professionista abilitato.

## Store listing — English
**Title:** Capocantiere
**Short:** Photo your home job: materials, costs, quote and step-by-step guidance.
**Full:**
Capocantiere is your assistant for home improvement jobs. Take a photo of the problem: the app identifies the trade, estimates materials and quantities, prices the work with local price lists and builds a shareable PDF quote.

• AI diagnosis from photos
• Step-by-step guides with photo check of the result
• Numbered quotes, sites and statuses
• Archive of your jobs and quotes with CSV export
• Price lists for Italy, Netherlands, Germany, Spain and Belgium
• Italian, English, Spanish

7-day free trial with everything included, then €4.99 per month. Estimates are indicative: for gas, electrical or structural work hire a qualified professional.

## Ficha — Español
**Título:** Capocantiere
**Corta:** Haz una foto de tu obra: materiales, costes, presupuesto y pasos guiados.
**Completa:**
Capocantiere es tu asistente para reformas del hogar. Haz una foto del problema: la app reconoce el oficio, estima materiales y cantidades, calcula el coste con las tarifas de tu país y crea un presupuesto en PDF para compartir.

• Diagnóstico con IA a partir de fotos
• Pasos guiados con revisión del resultado por foto
• Presupuestos numerados, obras y estados
• Archivo de trabajos y presupuestos con exportación CSV
• Tarifas de Italia, Países Bajos, Alemania, España y Bélgica
• Italiano, English, Español

7 días de prueba gratis con todo incluido, después 4,99 € al mes. Las estimaciones son orientativas: para gas, electricidad o estructuras contrata a un profesional.

## Data safety (risposte)
- Raccoglie: email (account), foto e contenuti creati dall'utente, nome cliente nei preventivi, ID/identificativi dell'account.
- Condivisi con terzi: foto e testi sono inviati a OpenAI per l'analisi (dichiaralo come "condivisione per funzionalità dell'app").
- Crittografia in transito: sì (HTTPS). Eliminazione dei dati: sì, dall'app. Nessuna pubblicità, nessun tracciamento.
- Classificazione contenuti: nessuna violenza/gioco; Pubblico: adulti (18+) consigliato.

## Screenshot richiesti
Almeno 2 per telefono (min 320 px, rapporto 16:9 o 9:16), consigliati 4–8: home, nuovo lavoro, preventivo, archivio, abbonamento. Anche 7" e 10" se vuoi la vetrina tablet.

## ATTENZIONE: pagamenti
Il pagamento oggi passa da Stripe. Per Google Play, sbloccare funzioni digitali dentro l'app richiede **Play Billing**: non ancora implementato. Finché non lo è: nella versione Play non mostrare il pulsante di pagamento (l'utente si abbona dal sito) oppure aggiungi Play Billing. Vedi `STORE.md`.

## Build
```bash
npm i -g @bubblewrap/cli
mkdir twa && cd twa && cp ../play/twa-manifest.json .
bubblewrap init --manifest https://capocantiere-production.up.railway.app/manifest.webmanifest
bubblewrap build        # crea app-release-bundle.aab (carica questo) + android.keystore
```
Conserva `android.keystore` e la password (copia fuori dal repo). Poi su Railway: `ANDROID_PACKAGE=app.capocantiere.twa` e `ANDROID_SHA256=<impronta da Play Console → Integrità dell'app>`.
