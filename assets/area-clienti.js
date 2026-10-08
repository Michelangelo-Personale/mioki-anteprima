/* =========================================================
   MIOKI — area clienti (aziende)
   Il percorso e: registrazione con i dati dell'azienda → la richiesta
   resta in attesa → noi la approviamo → da quel momento il cliente
   vede i prezzi all'ingrosso su tutto il sito.

   Qui la cosa e simulata in locale (localStorage) per far vedere il
   funzionamento. Su Shopify: account cliente reale, i dati azienda nei
   metacampi, l'approvazione e il tag "ingrosso" messo dal pannello, e
   i prezzi scontati da listino B2B o da uno sconto automatico sul tag.
   ========================================================= */
(function () {
  'use strict';

  var K_ACCOUNT = 'mioki_account';     // l'account di chi sta navigando
  var K_RICHIESTE = 'mioki_richieste'; // la coda delle richieste (lato nostro)
  var K_RIV = 'mioki_rivenditore';     // interruttore dei prezzi all'ingrosso

  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function leggi(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function scrivi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function account() { return leggi(K_ACCOUNT, null); }
  function richieste() { return leggi(K_RICHIESTE, []); }

  /* i prezzi all'ingrosso si accendono solo se l'account e approvato */
  function allineaPrezzi() {
    var a = account();
    try {
      if (a && a.stato === 'approvato') localStorage.setItem(K_RIV, 'si');
      else localStorage.removeItem(K_RIV);
    } catch (e) {}
  }
  allineaPrezzi();

  /* ---------- registrazione ---------- */
  function initRegistrazione() {
    var form = qs('[data-form-registrazione]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {};
      qsa('input, select, textarea', form).forEach(function (c) {
        if (c.name) d[c.name] = c.type === 'checkbox' ? c.checked : c.value.trim();
      });

      // la partita IVA italiana ha 11 cifre: controllo minimo, lato server andra' validata davvero
      if (!/^\d{11}$/.test((d.piva || '').replace(/\s/g, ''))) {
        return mostra(form, 'err', 'La partita IVA deve avere 11 cifre. Controlla e riprova.');
      }
      if ((d.password || '').length < 8) {
        return mostra(form, 'err', 'La password deve avere almeno 8 caratteri.');
      }

      var richiesta = {
        id: 'R' + Date.now().toString().slice(-6),
        inviata: new Date().toISOString(),
        stato: 'in_attesa',
        azienda: d.azienda, piva: d.piva, sdi: d.sdi,
        indirizzo: d.indirizzo, cap: d.cap, citta: d.citta, provincia: d.provincia,
        referente: d.referente, telefono: d.telefono, email: d.email,
        attivita: d.attivita, volume: d.volume, note: d.note
      };
      var coda = richieste();
      coda.unshift(richiesta);
      scrivi(K_RICHIESTE, coda);
      scrivi(K_ACCOUNT, richiesta);
      allineaPrezzi();

      form.innerHTML =
        '<div class="messaggio ok"><b>Richiesta inviata.</b><br>' +
        'Verifichiamo la partita IVA e ti scriviamo a <b>' + richiesta.email + '</b> ' +
        'entro un giorno lavorativo. Il numero della tua richiesta è <b>' + richiesta.id + '</b>.</div>' +
        '<a class="btn btn-primario" href="/pages/area-clienti">Vai alla tua area</a>';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function mostra(form, tipo, testo) {
    var box = qs('[data-esito]', form) || qs('[data-esito]');
    if (!box) return alert(testo);
    box.className = 'messaggio ' + tipo;
    box.innerHTML = testo;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- accesso ---------- */
  function initAccesso() {
    var form = qs('[data-form-accesso]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = qs('#acc-email', form).value.trim().toLowerCase();
      var trovato = richieste().filter(function (r) {
        return (r.email || '').toLowerCase() === email;
      })[0];

      if (!trovato) {
        return mostra(form, 'err',
          'Non troviamo un account con questa email. <a href="/pages/registrazione"><b>Registra la tua azienda</b></a>.');
      }
      scrivi(K_ACCOUNT, trovato);
      allineaPrezzi();
      window.location.href = (window.MIOKI_BASE || '/') + (window.MIOKI_BASE ? 'pages/area-clienti/index.html' : 'pages/area-clienti');
    });
  }

  /* ---------- area clienti ---------- */
  function initArea() {
    var box = qs('[data-area-clienti]');
    if (!box) return;
    var a = account();

    if (!a) {
      box.innerHTML =
        '<div class="scheda-form" style="text-align:center">' +
        '<h3 style="margin-bottom:.7rem">Non hai ancora effettuato l\'accesso</h3>' +
        '<p style="margin:0 auto 1.4rem">Entra con l\'email della tua azienda, oppure registrati: ' +
        'ci vogliono due minuti e i dati della partita IVA.</p>' +
        '<div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap">' +
        '<a class="btn btn-primario" href="/pages/accedi">Accedi</a>' +
        '<a class="btn btn-linea" href="/pages/registrazione">Registra la tua azienda</a>' +
        '</div></div>';
      return;
    }

    var statoHtml, azioni = '';
    if (a.stato === 'approvato') {
      statoHtml = '<div class="messaggio ok"><b>Account approvato.</b><br>' +
        'Su tutto il sito vedi i <b>prezzi all\'ingrosso</b>, scontati del ' +
        (window.MIOKI_SCONTO_RIVENDITORE || 25) + '% sul listino al pubblico.</div>';
      azioni = '<a class="btn btn-primario" href="/collections/balconi">Vai al catalogo con i tuoi prezzi</a>';
    } else if (a.stato === 'rifiutato') {
      statoHtml = '<div class="messaggio err"><b>Richiesta non accolta.</b><br>' +
        'I dati non risultano verificabili. Scrivici a <a href="mailto:info@mioki.it">info@mioki.it</a> ' +
        'e troviamo la soluzione.</div>';
    } else {
      statoHtml = '<div class="messaggio attesa"><b>Richiesta in verifica.</b><br>' +
        'Stiamo controllando la partita IVA. Ti scriviamo a <b>' + a.email + '</b> ' +
        'entro un giorno lavorativo: da quel momento vedrai i prezzi all\'ingrosso.</div>';
      azioni = '<a class="btn btn-linea" href="/collections/balconi">Intanto guarda il catalogo</a>';
    }

    box.innerHTML =
      statoHtml +
      '<div class="area-griglia">' +
        '<div class="scheda-form">' +
          '<h3 style="margin-bottom:1rem">I dati della tua azienda</h3>' +
          riga('Ragione sociale', a.azienda) +
          riga('Partita IVA', a.piva) +
          riga('Codice SDI / PEC', a.sdi) +
          riga('Sede', [a.indirizzo, a.cap, a.citta, a.provincia ? '(' + a.provincia + ')' : ''].filter(Boolean).join(' ')) +
          riga('Referente', a.referente) +
          riga('Telefono', a.telefono) +
          riga('Email', a.email) +
          riga('Attività', a.attivita) +
          '<p class="nota-form">Per cambiare un dato scrivici: le modifiche passano da una nuova verifica.</p>' +
        '</div>' +
        '<div>' +
          '<div class="scheda-form" style="margin-bottom:1.2rem">' +
            '<h3 style="margin-bottom:.8rem">Stato della richiesta</h3>' +
            riga('Numero', a.id) +
            riga('Inviata il', new Date(a.inviata).toLocaleDateString('it-IT')) +
            riga('Stato', etichettaStato(a.stato)) +
          '</div>' +
          '<div class="scheda-form">' +
            '<h3 style="margin-bottom:.8rem">I tuoi ordini</h3>' +
            '<p style="font-size:.94rem">Non hai ancora fatto ordini. Quando ne farai uno, ' +
            'lo trovi qui con lo stato della spedizione.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:.8rem;margin-top:1.6rem;flex-wrap:wrap">' + azioni +
      '<button class="btn btn-linea" data-esci>Esci</button></div>';

    var esci = qs('[data-esci]', box);
    if (esci) esci.addEventListener('click', function () {
      try { localStorage.removeItem(K_ACCOUNT); localStorage.removeItem(K_RIV); } catch (e) {}
      window.location.href = (window.MIOKI_BASE || '/') + (window.MIOKI_BASE ? 'index.html' : '');
    });
  }

  function riga(etichetta, valore) {
    if (!valore) return '';
    return '<div class="dato"><span>' + etichetta + '</span><b>' + valore + '</b></div>';
  }
  function etichettaStato(s) {
    if (s === 'approvato') return '<span class="pill ok">Approvato</span>';
    if (s === 'rifiutato') return '<span class="pill no">Non accolto</span>';
    return '<span class="pill attesa">In verifica</span>';
  }

  /* ---------- pannello nostro: approvare le richieste ---------- */
  function initGestione() {
    var box = qs('[data-gestione-richieste]');
    if (!box) return;

    function disegna() {
      var coda = richieste();
      if (!coda.length) {
        box.innerHTML = '<div class="scheda-form" style="text-align:center">' +
          '<p>Nessuna richiesta. Provane una da <a href="/pages/registrazione"><b>qui</b></a> ' +
          'per vedere come funziona.</p></div>';
        return;
      }
      box.innerHTML = coda.map(function (r) {
        return '<div class="scheda-form richiesta">' +
          '<div class="richiesta-testa">' +
            '<div><h3>' + r.azienda + '</h3>' +
            '<span class="meta">' + r.id + ' · ' + new Date(r.inviata).toLocaleDateString('it-IT') + '</span></div>' +
            etichettaStato(r.stato) +
          '</div>' +
          '<div class="richiesta-dati">' +
            riga('Partita IVA', r.piva) + riga('SDI / PEC', r.sdi) +
            riga('Referente', r.referente) + riga('Telefono', r.telefono) +
            riga('Email', r.email) + riga('Attività', r.attivita) +
            riga('Sede', [r.indirizzo, r.cap, r.citta].filter(Boolean).join(' ')) +
            riga('Volume previsto', r.volume) +
          '</div>' +
          (r.note ? '<p class="nota-form">Note: ' + r.note + '</p>' : '') +
          (r.stato === 'in_attesa'
            ? '<div style="display:flex;gap:.7rem;margin-top:1rem;flex-wrap:wrap">' +
              '<button class="btn btn-primario btn-sm" data-approva="' + r.id + '">Approva e attiva l\'ingrosso</button>' +
              '<button class="btn btn-linea btn-sm" data-rifiuta="' + r.id + '">Non accogliere</button></div>'
            : '<div style="display:flex;gap:.7rem;margin-top:1rem">' +
              '<button class="btn btn-linea btn-sm" data-riapri="' + r.id + '">Rimetti in verifica</button></div>') +
          '</div>';
      }).join('');

      function cambia(id, stato) {
        var coda = richieste().map(function (r) {
          if (r.id === id) r.stato = stato;
          return r;
        });
        scrivi(K_RICHIESTE, coda);
        var a = account();
        if (a && a.id === id) { a.stato = stato; scrivi(K_ACCOUNT, a); }
        allineaPrezzi();
        disegna();
      }
      qsa('[data-approva]', box).forEach(function (b) {
        b.addEventListener('click', function () { cambia(b.dataset.approva, 'approvato'); });
      });
      qsa('[data-rifiuta]', box).forEach(function (b) {
        b.addEventListener('click', function () { cambia(b.dataset.rifiuta, 'rifiutato'); });
      });
      qsa('[data-riapri]', box).forEach(function (b) {
        b.addEventListener('click', function () { cambia(b.dataset.riapri, 'in_attesa'); });
      });
    }
    disegna();
  }

  /* ---------- la voce di menu cambia se sei dentro ---------- */
  function initMenu() {
    var a = account();
    qsa('[data-voce-area]').forEach(function (el) {
      if (!a) return;
      el.textContent = a.stato === 'approvato' ? 'La tua area' : 'Richiesta in verifica';
    });
    if (a && a.stato === 'approvato') {
      qsa('[data-se-ingrosso]').forEach(function (e) { e.hidden = false; });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initRegistrazione(); initAccesso(); initArea(); initGestione(); initMenu();
  });
})();
