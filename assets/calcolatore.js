/* =========================================================
   MIOKI — calcolatore "quanti metri ti servono"
   Il prodotto e modulare da 1 metro, quindi il conto parte dai metri
   lineari e ricava moduli, montanti e superficie. I montanti sono
   sempre uno in piu dei moduli (inizio e fine impianto).
   I prezzi arrivano dal data-attribute, cosi restano una sola fonte.
   ========================================================= */
(function () {
  'use strict';

  var box = document.querySelector('[data-calcolatore]');
  if (!box) return;

  var MODELLI = JSON.parse(box.dataset.modelli || '{}');
  var PREZZO_MONTANTE = parseFloat(box.dataset.prezzoMontante || '49');
  var SOGLIA_SPEDIZIONE = 1500;

  var selModello = box.querySelector('#calc-modello');
  var inpMetri = box.querySelector('#calc-metri');
  var gruppoTinte = box.querySelector('[data-calc-tinte]');
  var chkAngolo = box.querySelector('#calc-angolo');

  function euro(v) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR',
      minimumFractionDigits: 2 }).format(v);
  }
  function tintaScelta() {
    var b = gruppoTinte.querySelector('.scelta-tinta[aria-pressed="true"]');
    return b ? { id: b.dataset.tinta, nome: b.dataset.nome } : { id: '', nome: '' };
  }

  function calcola() {
    var m = Math.max(1, Math.ceil(parseFloat(inpMetri.value) || 1));
    var mod = MODELLI[selModello.value];
    if (!mod) return;

    var moduli = m;
    var montanti = moduli + 1;
    var prezzoUnit = window.MiokiPrezzo ? window.MiokiPrezzo(mod.prezzo) : mod.prezzo;
    var prezzoMont = window.MiokiPrezzo ? window.MiokiPrezzo(PREZZO_MONTANTE) : PREZZO_MONTANTE;

    var costoModuli = moduli * prezzoUnit;
    var costoMontanti = montanti * prezzoMont;
    var costoAngolo = chkAngolo && chkAngolo.checked ? (window.MiokiPrezzo ? window.MiokiPrezzo(89) : 89) : 0;
    var totale = costoModuli + costoMontanti + costoAngolo;
    var superficie = moduli * (mod.altezza_mm / 1000);

    box.querySelector('[data-out-moduli]').textContent = moduli + (moduli === 1 ? ' modulo' : ' moduli');
    box.querySelector('[data-out-montanti]').textContent = montanti;
    box.querySelector('[data-out-superficie]').textContent =
      superficie.toFixed(2).replace('.', ',') + ' m²';
    box.querySelector('[data-out-altezza]').textContent = mod.altezza_mm + ' mm';
    box.querySelector('[data-out-moduli-costo]').textContent = euro(costoModuli);
    box.querySelector('[data-out-montanti-costo]').textContent = euro(costoMontanti);
    var rigaAngolo = box.querySelector('[data-riga-angolo]');
    if (rigaAngolo) {
      rigaAngolo.hidden = costoAngolo === 0;
      box.querySelector('[data-out-angolo-costo]').textContent = euro(costoAngolo);
    }
    box.querySelector('[data-out-totale]').textContent = euro(totale);
    box.querySelector('[data-out-rata]').textContent = euro(totale / 12);
    var sped = box.querySelector('[data-out-spedizione]');
    if (sped) {
      sped.textContent = totale >= SOGLIA_SPEDIZIONE
        ? 'Spedizione gratuita inclusa.'
        : 'Ti mancano ' + euro(SOGLIA_SPEDIZIONE - totale) + ' per la spedizione gratuita.';
    }

    // anteprima: il disegno tecnico del modello scelto (la tinta non cambia il disegno)
    var ante = box.querySelector('[data-calc-anteprima]');
    if (ante) {
      var url = (window.MIOKI_DISEGNI || {})[selModello.value];
      if (url) ante.innerHTML = '<img src="' + url + '" alt="Disegno del modulo ' + mod.nome + '">';
    }

    // dati pronti per il bottone "aggiungi tutto al carrello"
    var btn = box.querySelector('[data-calc-aggiungi]');
    if (btn) {
      btn.dataset.pacchetto = JSON.stringify({
        modello: selModello.value, nome: mod.nome, moduli: moduli, montanti: montanti,
        tinta: tintaScelta().nome, prezzoUnit: mod.prezzo, angolo: costoAngolo > 0
      });
    }
  }

  selModello.addEventListener('change', calcola);
  inpMetri.addEventListener('input', calcola);
  if (chkAngolo) chkAngolo.addEventListener('change', calcola);

  box.querySelectorAll('[data-passo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = parseFloat(inpMetri.value) || 1;
      inpMetri.value = Math.max(1, v + (b.dataset.passo === '+' ? 1 : -1));
      calcola();
    });
  });

  gruppoTinte.querySelectorAll('.scelta-tinta').forEach(function (b) {
    b.addEventListener('click', function () {
      gruppoTinte.querySelectorAll('.scelta-tinta').forEach(function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      b.setAttribute('aria-pressed', 'true');
      calcola();
    });
  });

  // aggiunge moduli + montanti al carrello in un colpo solo
  var btnAgg = box.querySelector('[data-calc-aggiungi]');
  if (btnAgg) {
    btnAgg.addEventListener('click', function () {
      var p = JSON.parse(btnAgg.dataset.pacchetto || '{}');
      if (!p.modello) return;
      var C = window.MiokiCarrello;
      C.aggiungi({
        handle: p.modello, titolo: p.nome, prezzo: p.prezzoUnit, qta: p.moduli,
        tinta: p.tinta, modello: p.modello,
        immagine: (window.MIOKI_DISEGNI || {})[p.modello] || ''
      });
      C.aggiungi({
        handle: 'montante-supplementare', titolo: 'Montante supplementare',
        prezzo: PREZZO_MONTANTE, qta: p.montanti, tinta: '',
        immagine: (window.MIOKI_ICONE || {}).montante || ''
      });
      if (p.angolo) {
        C.aggiungi({ handle: 'kit-angolo', titolo: 'Kit angolo 90°', prezzo: 89, qta: 1,
          tinta: '', immagine: (window.MIOKI_ICONE || {}).angolo || '' });
      }
      var t = btnAgg.querySelector('[data-testo]') || btnAgg;
      var orig = t.textContent;
      t.textContent = 'Aggiunto ✓ vai al carrello';
      setTimeout(function () { t.textContent = orig; }, 2200);
    });
  }

  calcola();
})();
