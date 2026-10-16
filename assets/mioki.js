/* =========================================================
   MIOKI — comportamento del tema
   Il carrello parla con l'AJAX API di Shopify quando il tema gira
   davvero su Shopify; in locale ricade su un carrello in localStorage,
   cosi la bozza si puo' provare per intero prima che lo store esista.
   ========================================================= */
(function () {
  'use strict';

  var SU_SHOPIFY = !!(window.Shopify && window.Shopify.routes);
  var CHIAVE = 'mioki_carrello';
  var CHIAVE_RIV = 'mioki_rivenditore';
  var SCONTO_RIV = window.MIOKI_SCONTO_RIVENDITORE || 25;

  /* ---------- utilita' ---------- */
  function euro(v) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR',
      minimumFractionDigits: 2 }).format(v);
  }
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- stato rivenditore ---------- */
  function rivenditoreAttivo() {
    try { return localStorage.getItem(CHIAVE_RIV) === 'si'; } catch (e) { return false; }
  }
  function prezzoEffettivo(p) {
    return rivenditoreAttivo() ? Math.round(p * (100 - SCONTO_RIV)) / 100 : p;
  }
  window.MiokiPrezzo = prezzoEffettivo;

  /* ---------- carrello ---------- */
  function leggiCarrello() {
    try { return JSON.parse(localStorage.getItem(CHIAVE) || '[]'); } catch (e) { return []; }
  }
  function scriviCarrello(righe) {
    try { localStorage.setItem(CHIAVE, JSON.stringify(righe)); } catch (e) {}
    aggiornaPallino();
    document.dispatchEvent(new CustomEvent('mioki:carrello', { detail: righe }));
  }
  function aggiungi(riga) {
    if (SU_SHOPIFY && riga.variant_id) {
      return fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: riga.variant_id, quantity: riga.qta,
          properties: riga.proprieta || {} }] })
      }).then(function (r) { return r.json(); }).then(aggiornaPallino);
    }
    var righe = leggiCarrello();
    var chiave = riga.handle + '|' + (riga.tinta || '') ;
    var esistente = righe.filter(function (r) { return (r.handle + '|' + (r.tinta || '')) === chiave; })[0];
    if (esistente) { esistente.qta += riga.qta; } else { righe.push(riga); }
    scriviCarrello(righe);
    return Promise.resolve(righe);
  }
  window.MiokiCarrello = { leggi: leggiCarrello, scrivi: scriviCarrello, aggiungi: aggiungi, euro: euro };

  function totaleArticoli() {
    return leggiCarrello().reduce(function (n, r) { return n + r.qta; }, 0);
  }
  function aggiornaPallino() {
    var n = totaleArticoli();
    qsa('[data-pallino-carrello]').forEach(function (el) {
      el.textContent = n;
      if (n > 0) { el.removeAttribute('hidden'); } else { el.setAttribute('hidden', ''); }
    });
  }


  /* ---------- altezza della testata ----------
     Annuncio e header stanno in un unico blocco fisso: misuriamo quanto e'
     alto davvero e lo diciamo al CSS, cosi' il contenuto parte esattamente
     sotto e non restano fessure ne' spazi vuoti. */
  function initTestata() {
    var t = qs('.testata');
    if (!t) return;
    var aggiorna = function () {
      document.documentElement.style.setProperty('--h-testata', Math.round(t.offsetHeight) + 'px');
    };
    aggiorna();
    window.addEventListener('resize', aggiorna);
    window.addEventListener('load', aggiorna);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(aggiorna);
  }

  /* ---------- header ---------- */
  function initHeader() {
    var head = qs('header');
    var burger = qs('#burger');
    var links = qs('#navLinks');
    if (head) {
      var onScroll = function () {
        head.classList.toggle('scrolled', window.scrollY > 12);
        document.body.classList.toggle('scrollato', window.scrollY > 40);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    if (burger && links) {
      burger.addEventListener('click', function () {
        var aperto = links.classList.toggle('aperto');
        burger.classList.toggle('aperto', aperto);
        burger.setAttribute('aria-expanded', aperto ? 'true' : 'false');
      });
      qsa('a', links).forEach(function (a) {
        a.addEventListener('click', function () {
          links.classList.remove('aperto');
          burger.classList.remove('aperto');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }


  /* ---------- immagini dell'hero ----------
     Si alternano da sole; i punti in basso permettono di scegliere.
     Il giro si ferma quando la pagina non e' in primo piano, per non
     consumare batteria inutilmente. */
  function initHero() {
    var hero = qs('[data-hero]');
    if (!hero) return;
    var slides = qsa('.hero-slide', hero);
    var punti = qsa('[data-hero-punti] button', hero);
    if (slides.length < 2) return;

    var i = 0, timer = null;
    var durata = (parseInt(hero.dataset.durata, 10) || 6) * 1000;

    function vai(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('attiva', k === i); });
      punti.forEach(function (p, k) { p.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    }
    function avvia() { ferma(); timer = setInterval(function () { vai(i + 1); }, durata); }
    function ferma() { if (timer) { clearInterval(timer); timer = null; } }

    punti.forEach(function (p, k) {
      p.addEventListener('click', function () { vai(k); avvia(); });
    });
    hero.addEventListener('mouseenter', ferma);
    hero.addEventListener('mouseleave', avvia);
    document.addEventListener('visibilitychange', function () {
      document.hidden ? ferma() : avvia();
    });

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) avvia();
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    qsa('.faq-d').forEach(function (b) {
      b.addEventListener('click', function () {
        var item = b.closest('.faq-item');
        var risp = qs('.faq-r', item);
        var aperto = item.classList.toggle('aperto');
        b.setAttribute('aria-expanded', aperto ? 'true' : 'false');
        risp.style.maxHeight = aperto ? risp.scrollHeight + 'px' : '0px';
      });
    });
  }

  /* ---------- switch fra collezioni (rif. ELEO) ---------- */
  function initSwitch() {
    qsa('[data-switch]').forEach(function (gruppo) {
      var bottoni = qsa('button', gruppo);
      bottoni.forEach(function (b) {
        b.addEventListener('click', function () {
          bottoni.forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
          b.setAttribute('aria-selected', 'true');
          var filtro = b.dataset.filtro;
          qsa('[data-gruppo="' + gruppo.dataset.switch + '"] [data-collezione]').forEach(function (card) {
            var mostra = filtro === 'tutti' ||
              card.dataset.collezione === filtro ||
              (filtro === 'saldo' && card.dataset.saldo === 'si');
            card.style.display = mostra ? '' : 'none';
          });
        });
      });
    });
  }

  /* ---------- galleria prodotto ---------- */
  function initGalleria() {
    var main = qs('[data-galleria-main]');
    if (!main) return;
    qsa('[data-galleria-mini] button').forEach(function (b) {
      b.addEventListener('click', function () {
        qsa('[data-galleria-mini] button').forEach(function (x) { x.setAttribute('aria-current', 'false'); });
        b.setAttribute('aria-current', 'true');
        main.classList.toggle('con-foto', b.classList.contains('con-foto'));
        main.innerHTML = '<img src="' + b.dataset.src + '" alt="' + (b.dataset.alt || '') + '">';
      });
    });
  }

  /* ---------- scelta tinta sulla pagina prodotto ---------- */
  function initTinte() {
    qsa('[data-tinte]').forEach(function (gruppo) {
      var bottoni = qsa('.scelta-tinta', gruppo);
      bottoni.forEach(function (b) {
        b.addEventListener('click', function () {
          bottoni.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          // il disegno tecnico è fisso: la tinta aggiorna solo l'etichetta
          qsa('[data-tinta-scelta]').forEach(function (el) { el.textContent = b.dataset.nome; });
        });
      });
    });
  }

  /* ---------- aggiungi al carrello ---------- */
  function initAggiungi() {
    qsa('[data-aggiungi]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.dataset;
        var gruppoTinte = qs('[data-tinte]');
        var tintaSel = gruppoTinte ? qs('.scelta-tinta[aria-pressed="true"]', gruppoTinte) : null;
        var qtaInput = qs('[data-qta]');
        aggiungi({
          handle: d.aggiungi,
          titolo: d.titolo,
          prezzo: parseFloat(d.prezzo),
          immagine: d.immagine,
          tinta: tintaSel ? tintaSel.dataset.nome : (d.tinta || ''),
          modello: d.modello || '',
          qta: qtaInput ? parseInt(qtaInput.value, 10) || 1 : 1,
          variant_id: d.variantId || null
        }).then(function () {
          b.classList.add('aggiunto');
          var testo = b.querySelector('[data-testo]') || b;
          var orig = testo.textContent;
          testo.textContent = 'Aggiunto al carrello ✓';
          setTimeout(function () { testo.textContent = orig; b.classList.remove('aggiunto'); }, 1800);
        });
      });
    });
    // selettore quantita'
    qsa('.qta').forEach(function (box) {
      var input = qs('input', box);
      qsa('button', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = parseInt(input.value, 10) || 1;
          input.value = Math.max(1, v + (b.dataset.passo === '+' ? 1 : -1));
        });
      });
    });
  }

  /* ---------- pagina carrello ---------- */
  function initPaginaCarrello() {
    var contenitore = qs('[data-righe-carrello]');
    if (!contenitore) return;

    function disegna() {
      var righe = leggiCarrello();
      var spedizioneSoglia = 1500;
      if (!righe.length) {
        contenitore.innerHTML =
          '<div class="vuoto">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></svg>' +
          '<h3>Il carrello e vuoto</h3>' +
          '<p style="margin:.6rem auto 1.4rem">Non hai ancora aggiunto nessun modulo.</p>' +
          '<a class="btn btn-primario" href="/collections/balconi">Guarda i balconi</a>' +
          '</div>';
        qsa('[data-riepilogo]').forEach(function (e) { e.style.display = 'none'; });
        return;
      }
      qsa('[data-riepilogo]').forEach(function (e) { e.style.display = ''; });
      contenitore.innerHTML = righe.map(function (r, i) {
        var pz = prezzoEffettivo(r.prezzo);
        return '<div class="riga-carrello">' +
          '<div class="mini"><img src="' + r.immagine + '" alt=""></div>' +
          '<div><h4>' + r.titolo + '</h4>' +
          (r.tinta ? '<div class="meta">Tinta: ' + r.tinta + '</div>' : '') +
          '<div class="meta">' + r.qta + ' × ' + euro(pz) + '</div>' +
          '<button class="rimuovi" data-rimuovi="' + i + '">Rimuovi</button></div>' +
          '<div><b>' + euro(pz * r.qta) + '</b></div>' +
          '</div>';
      }).join('');

      var subtotale = righe.reduce(function (s, r) { return s + prezzoEffettivo(r.prezzo) * r.qta; }, 0);
      var spedizione = subtotale >= spedizioneSoglia || subtotale === 0 ? 0 : 89;
      qsa('[data-subtotale]').forEach(function (e) { e.textContent = euro(subtotale); });
      qsa('[data-spedizione]').forEach(function (e) {
        e.textContent = spedizione === 0 ? 'Gratis' : euro(spedizione);
      });
      qsa('[data-totale]').forEach(function (e) { e.textContent = euro(subtotale + spedizione); });
      qsa('[data-manca-spedizione]').forEach(function (e) {
        var manca = spedizioneSoglia - subtotale;
        e.textContent = manca > 0
          ? 'Ti mancano ' + euro(manca) + ' per la spedizione gratuita.'
          : 'Spedizione gratuita inclusa.';
      });

      qsa('[data-rimuovi]').forEach(function (b) {
        b.addEventListener('click', function () {
          var righe2 = leggiCarrello();
          righe2.splice(parseInt(b.dataset.rimuovi, 10), 1);
          scriviCarrello(righe2);
          disegna();
        });
      });
    }
    disegna();
    document.addEventListener('mioki:carrello', disegna);
  }

  /* ---------- area rivenditori ---------- */
  function initRivenditori() {
    var form = qs('[data-login-rivenditore]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var esito = qs('[data-esito-login]');
        try { localStorage.setItem(CHIAVE_RIV, 'si'); } catch (err) {}
        esito.className = 'messaggio ok';
        esito.textContent = 'Accesso effettuato. I prezzi che vedi ora sono quelli netti riservati ai rivenditori (−' + SCONTO_RIV + '%).';
        esito.hidden = false;
        setTimeout(function () { window.location.href = (window.MIOKI_BASE || '/') + (window.MIOKI_BASE ? 'collections/balconi/index.html' : 'collections/balconi'); }, 1600);
      });
    }
    var reg = qs('[data-registrazione-rivenditore]');
    if (reg) {
      reg.addEventListener('submit', function (e) {
        e.preventDefault();
        var esito = qs('[data-esito-registrazione]');
        esito.className = 'messaggio ok';
        esito.textContent = 'Richiesta inviata. Verifichiamo la partita IVA e ti scriviamo entro un giorno lavorativo con le credenziali.';
        esito.hidden = false;
        reg.reset();
      });
    }
    var esci = qs('[data-esci-rivenditore]');
    if (esci) {
      esci.addEventListener('click', function () {
        try { localStorage.removeItem(CHIAVE_RIV); } catch (err) {}
        window.location.reload();
      });
    }
    // fascia "stai vedendo i prezzi rivenditore"
    if (rivenditoreAttivo()) {
      qsa('[data-se-rivenditore]').forEach(function (e) { e.hidden = false; });
      qsa('[data-prezzo-listino]').forEach(function (e) {
        var base = parseFloat(e.dataset.prezzoListino);
        if (!isNaN(base)) e.textContent = euro(prezzoEffettivo(base));
      });
      qsa('[data-rata-listino]').forEach(function (e) {
        var base = parseFloat(e.dataset.rataListino);
        if (!isNaN(base)) e.textContent = euro(prezzoEffettivo(base) / 12);
      });
      // col listino netto il prezzo barrato non ha piu' senso
      qsa('.prezzo-vecchio').forEach(function (e) { e.style.display = 'none'; });
    }
  }

  /* ---------- traccia ordine ---------- */
  function initTraccia() {
    var form = qs('[data-traccia]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var esito = qs('[data-esito-traccia]');
      var num = qs('#numero-ordine').value.trim();
      esito.hidden = false;
      if (/^MK-?\d{4,}$/i.test(num)) {
        esito.className = 'messaggio ok';
        esito.innerHTML = '<b>Ordine ' + num + ' — in preparazione.</b><br>' +
          'I pannelli sono in lavorazione presso il nostro magazzino. ' +
          'Riceverai il codice di tracciamento del corriere via email appena il bancale parte.';
      } else {
        esito.className = 'messaggio err';
        esito.textContent = 'Non troviamo questo numero. Il codice ordine ha la forma MK-1234 e lo trovi nella mail di conferma.';
      }
    });
  }

  /* ---------- checkout simulato ---------- */
  function initCheckout() {
    var form = qs('[data-checkout]');
    if (!form) return;
    var righe = leggiCarrello();
    var elenco = qs('[data-checkout-righe]');
    if (elenco) {
      var tot = 0;
      elenco.innerHTML = righe.map(function (r) {
        var pz = prezzoEffettivo(r.prezzo) * r.qta; tot += pz;
        return '<div class="esito-riga"><span>' + r.qta + ' × ' + r.titolo +
          (r.tinta ? ' <small>(' + r.tinta + ')</small>' : '') + '</span><b>' + euro(pz) + '</b></div>';
      }).join('');
      var sped = tot >= 1500 || tot === 0 ? 0 : 89;
      elenco.innerHTML += '<div class="esito-riga"><span>Spedizione</span><b>' +
        (sped ? euro(sped) : 'Gratis') + '</b></div>';
      qsa('[data-checkout-totale]').forEach(function (e) { e.textContent = euro(tot + sped); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var esito = qs('[data-esito-checkout]');
      esito.hidden = false;
      esito.className = 'messaggio ok';
      esito.innerHTML = '<b>Questa e una bozza: nessun pagamento e stato addebitato.</b><br>' +
        'Sullo store Shopify vero questo bottone porta al checkout di Shopify, con carta, ' +
        'bonifico e pagamento a rate gia attivi.';
      esito.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ---------- avviso bozza ---------- */
  function initAvviso() {
    var a = qs('[data-avviso-bozza]');
    if (!a) return;
    try { if (sessionStorage.getItem('mioki_avviso') === 'chiuso') { a.remove(); return; } } catch (e) {}
    qs('button', a).addEventListener('click', function () {
      try { sessionStorage.setItem('mioki_avviso', 'chiuso'); } catch (e) {}
      a.remove();
    });
  }


  /* ---------- caricamento della pagina ---------- */
  function initLoader() {
    var l = qs('#loader');
    if (!l) return;
    var t0 = performance.now();
    var fatto = function () { l.classList.add('fatto'); };
    window.addEventListener('load', function () {
      setTimeout(fatto, Math.max(0, 900 - (performance.now() - t0)));
    });
    setTimeout(fatto, 2400);   // rete lenta: non resta mai bloccato
  }

  /* ---------- comparsa allo scroll ---------- */
  function initReveal() {
    var da = qsa('.rv, .rv-sx, .rv-dx, .sez-head');
    if (!('IntersectionObserver' in window)) {
      da.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (v.isIntersecting) { v.target.classList.add('in'); io.unobserve(v.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    da.forEach(function (e) { io.observe(e); });

    // rete di sicurezza: se qualcosa non e' mai stato osservato (scroll molto
    // rapido, salto a un'ancora, stampa), lo mostriamo comunque.
    setTimeout(function () {
      da.forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.2) e.classList.add('in');
      });
    }, 1200);
  }

  /* ---------- numeri che salgono ---------- */
  function initContatori() {
    var el = qsa('[data-conta]');
    if (!el.length || !('IntersectionObserver' in window)) {
      el.forEach(function (e) { e.textContent = e.dataset.conta; });
      return;
    }
    var io = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (!v.isIntersecting) return;
        io.unobserve(v.target);
        var e = v.target, fine = parseFloat(e.dataset.conta), t0 = performance.now();
        var passo = function (ora) {
          var p = Math.min((ora - t0) / 1400, 1);
          var val = fine * (1 - Math.pow(1 - p, 4));
          e.textContent = fine % 1 ? val.toFixed(1).replace('.', ',')
                                   : Math.round(val).toLocaleString('it-IT');
          if (p < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
    }, { threshold: .6 });
    el.forEach(function (e) { io.observe(e); });
  }

  /* ---------- avvio ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initTestata(); initLoader(); initReveal(); initContatori();
    initHeader(); initHero(); initFaq(); initSwitch(); initGalleria(); initTinte();
    initAggiungi(); initPaginaCarrello(); initRivenditori(); initTraccia();
    initCheckout(); initAvviso(); aggiornaPallino();
  });
})();
