# Capocantiere — Assistente casa e lavoro

Applicazione locale per preparare un fascicolo di cantiere: foto, diagnosi, progetto, materiali, quantità, preventivo, procedura, link per cercare i tutorial, checklist e report. Non è una chat che risponde e basta.

Funziona nel browser, senza server. I fascicoli e le foto restano in questo computer (IndexedDB).

## Avvio

```bash
npm install
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173).

Altri comandi:

- `npm test` esegue i controlli sui calcoli
- `npm run build` prepara la versione di produzione in `dist`

## Cosa funziona senza rete

Una volta caricata l’app, puoi calcolare quantità e preventivi, spuntare le fasi, allegare foto e stampare il report anche senza connessione. Quei numeri non passano dal modello.

Chiedono la rete:

- il primo caricamento dei caratteri (se mancano, il browser usa i suoi)
- i link «Cerca tutorial», che aprono una ricerca YouTube e non inventano titoli
- la diagnosi del fascicolo e la verifica visiva di una fase, che chiamano un’API compatibile con OpenAI

Se la chiave manca o la risposta non è un JSON valido, l’app mostra l’errore in italiano. Non sostituisce la diagnosi con un testo preconfezionato. Checklist e promemoria del mestiere restano, e sono etichettati come tali.

## Cosa fa l'AI

Tutto passa dal Capocantiere AI, che conosce misure, materiali, costi e a che punto sei:

- **Analizza le foto** (nuovo lavoro): riconosce il mestiere, stima le misure, precompila il form e dichiara cosa ha stimato a occhio e cosa devi misurare tu.
- **Assistente in chat** nel fascicolo: ti dice cosa fare ora, cosa controllare, accetta foto («va bene così?»).
- **«Spiegami come si fa»** su ogni fase: passi numerati, trucchi, errori da evitare, attrezzi, tempo.
- **Revisione del preventivo**: giudizio (congruo/basso/alto), voci che mancano, dove risparmiare, frase per il cliente. Propone le ore, non cambia i totali da sola.
- Diagnosi del fascicolo e verifica visiva di una fase, come prima.

I numeri calcolati in locale restano la fonte di verità: il modello non li sovrascrive.

## Chiave API (lato server)

Metti la chiave in `.env.local` (mai nel codice, già ignorato da git):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

`npm run dev` (o `npm run build && npm start`) avvia un piccolo proxy su `/api/ai/chat`: la chiave resta sul server e non finisce nel bundle del browser. In **Impostazioni** puoi comunque incollare una chiave personale: in quel caso il browser chiama direttamente il servizio e la chiave ha la precedenza.

## Quantità e prezzi

Sono stime, non un computo metrico né un listino.

- Idropittura interni: spesso circa 10–12 m²/L per mano. Qui si usa 11. Primer circa 12 m²/L.
- Pendenza: i centimetri per metro coincidono con la percentuale. 1,5% = 1,5 cm/m; su 5 m = 7,5 cm.
- Membrana cementizia bicomponente elastica: spesso circa 1,6 kg/m² per mm. Due mani per circa 2 mm, più 10% di sfrido.
- Piastrelle: metri quadri × (1 + sfrido). Lo stucco usa la regola `((A+B)/(A×B)) × fuga × spessore × 1,5` con i lati in millimetri.
- Cartongesso: lastre 120×200 cm, montanti ogni 60 cm, circa 22 viti a m² per strato.

Su ogni voce c’è scritto se il numero viene da una scheda tecnica (come ordine di grandezza), da una regola pratica o se va verificato in cantiere. La frase da non saltare è: consumo di riferimento — verificare sulla scheda tecnica del prodotto scelto.

I prezzi sono indicativi, modificabili, ordine di grandezza Italia 2024–2026. Non sono un’offerta.

## Sicurezza

Per l’elettricità il fascicolo chiede di togliere tensione, verificare l’assenza di tensione e ricorda che gli impianti fissi in Italia sono in genere lavoro da impresa abilitata, con dichiarazione di conformità. Per i tetti il primo passo è decidere se si può salire. Per l’idraulica si chiude l’acqua prima di smontare. La carica del gas di un climatizzatore non è descritta: resta al tecnico certificato.

## Video tutorial

Nelle fasi e nella chat l'app cerca video **reali** su YouTube (titolo, canale, durata) tramite il server locale e li riproduce dentro l'app. Se chiedi «mostrami un video…» in chat, l'AI scrive la ricerca giusta; altrimenti c'è il pulsante «Mostra video su questo» sotto ogni risposta. Facoltativo: `YOUTUBE_API_KEY` in `.env.local` per usare l'API ufficiale di YouTube invece della lettura della pagina dei risultati.
