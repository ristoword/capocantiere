import { Link } from 'react-router-dom'

const CONTACT = String(import.meta.env.VITE_CONTACT_EMAIL ?? '').trim()

function Contact() {
  return CONTACT ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : <span>il gestore dell’app (contatto indicato nello store o dove hai ricevuto l’invito)</span>
}

export function LegalPage({ kind }: { kind: 'privacy' | 'termini' }) {
  return (
    <div className="legal">
      <Link to="/" className="btn sm">← Torna all’app</Link>
      {kind === 'privacy' ? (
        <>
          <h1>Informativa sulla privacy</h1>
          <p className="help">Ultimo aggiornamento: novembre 2026</p>
          <h2>Chi tratta i dati</h2>
          <p>Titolare del trattamento è il gestore di Capocantiere. Per qualsiasi richiesta scrivi a <Contact />.</p>
          <h2>Quali dati raccogliamo</h2>
          <ul>
            <li><strong>Account:</strong> email, nome (facoltativo) e password. La password è conservata solo come impronta cifrata (scrypt), mai in chiaro.</li>
            <li><strong>I tuoi lavori:</strong> descrizioni, misure, preventivi, chat con l’assistente e le foto che carichi. Servono per fornirti il servizio e sono visibili solo a te.</li>
            <li><strong>Profilo professionale (facoltativo):</strong> ragione sociale, partita IVA, indirizzo, telefono e logo, usati solo per intestare i tuoi preventivi.</li>
            <li><strong>Dati tecnici:</strong> un cookie di sessione indispensabile per tenerti collegato e contatori d’uso per limitare gli abusi. Non usiamo cookie di profilazione né pubblicità.</li>
          </ul>
          <h2>Servizi di terzi</h2>
          <ul>
            <li><strong>OpenAI:</strong> quando usi l’assistente, il testo e le foto della richiesta sono inviati a OpenAI per generare la risposta. Non inserire dati personali di terzi nelle foto o nei messaggi.</li>
            <li><strong>YouTube:</strong> i video tutorial sono incorporati da YouTube (modalità a privacy avanzata); guardandoli si applicano le regole di Google.</li>
          </ul>
          <h2>Conservazione e cancellazione</h2>
          <p>I dati restano finché mantieni l’account. Da <em>Impostazioni → Account</em> puoi scaricare un backup completo e cancellare definitivamente l’account con tutti i dati.</p>
          <h2>I tuoi diritti</h2>
          <p>Hai diritto di accesso, rettifica, cancellazione, portabilità e opposizione (artt. 15–22 GDPR). Puoi esercitarli dall’app o scrivendo a <Contact />. Puoi anche proporre reclamo al Garante per la protezione dei dati personali.</p>
        </>
      ) : (
        <>
          <h1>Termini d’uso</h1>
          <p className="help">Ultimo aggiornamento: novembre 2026</p>
          <h2>Cos’è Capocantiere</h2>
          <p>Uno strumento di supporto per pianificare lavori di casa: calcola quantità e costi indicativi e fornisce spiegazioni generate da un’intelligenza artificiale.</p>
          <h2>Importante</h2>
          <ul>
            <li>I prezzi e le quantità sono <strong>stime indicative</strong>, non un’offerta né un listino. Verifica sempre schede tecniche e prezzi reali.</li>
            <li>L’AI può sbagliare. Le indicazioni <strong>non sostituiscono</strong> un professionista abilitato.</li>
            <li>Per impianti elettrici, gas, lavori in quota e interventi su strutture rivolgiti a un tecnico abilitato e rispetta le norme di sicurezza vigenti.</li>
            <li>Sei responsabile dei lavori che esegui e dei contenuti che carichi.</li>
          </ul>
          <h2>Uso corretto</h2>
          <p>Non usare il servizio per abusi, per aggirare i limiti d’uso o per caricare contenuti illeciti. Possiamo sospendere gli account che lo fanno.</p>
          <h2>Responsabilità</h2>
          <p>Il servizio è fornito «così com’è». Nei limiti di legge, il gestore non risponde di danni derivanti da stime, consigli o lavori eseguiti sulla base dell’app.</p>
          <p>Contatti: <Contact />.</p>
        </>
      )}
    </div>
  )
}
