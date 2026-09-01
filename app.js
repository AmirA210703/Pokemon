/* UI layer: search, routing and rendering. All analysis lives in engine.js. */
(function () {
  "use strict";

  var E = window.Engine, DEX = window.POKEDEX;
  E.index(DEX);

  var CDN = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/";
  var art = function (p) { return CDN + "other/official-artwork/" + p.img; };
  var sprite = function (p) { return CDN + p.img; };

  var $ = function (s) { return document.querySelector(s); };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var dex = function (n) { return "#" + String(n).padStart(3, "0"); };
  var sign = function (n) { return (n > 0 ? "+" : "") + n; };

  /* Fall back from official artwork to the small sprite, then give up quietly. */
  function img(p, cls, big) {
    var n = el("img", cls);
    n.src = big ? art(p) : sprite(p);
    n.alt = p.name;
    /* The artwork is the first thing on screen; only the small sprites further
       down the page are worth deferring. */
    n.loading = big ? "eager" : "lazy";
    if (big) n.setAttribute("fetchpriority", "high");
    n.decoding = "async";
    n.dataset.step = big ? "0" : "1";
    n.addEventListener("error", function () {
      if (n.dataset.step === "0") { n.dataset.step = "1"; n.src = sprite(p); }
      else { n.dataset.step = "2"; n.style.visibility = "hidden"; }
    });
    return n;
  }

  function typeChip(t) {
    var s = el("span", "type t-" + t, cap(t));
    return s;
  }

  /* ---------------- search ---------------- */

  var input = $("#q"), listEl = $("#results"), cursor = -1, hits = [];

  function score(p, q) {
    var n = p.name.toLowerCase(), s = p.slug;
    if (n === q || s === q) return 0;
    if (n.indexOf(q) === 0 || s.indexOf(q) === 0) return 1;
    if (String(p.id) === q) return 1;
    if (n.indexOf(q) > 0 || s.indexOf(q) > 0) return 2;
    if (p.types.some(function (t) { return t.indexOf(q) === 0; })) return 3;
    return -1;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return DEX.map(function (p) { return {p: p, s: score(p, q)}; })
      .filter(function (r) { return r.s >= 0; })
      .sort(function (a, b) { return a.s - b.s || a.p.id - b.p.id; })
      .slice(0, 40)
      .map(function (r) { return r.p; });
  }

  function renderResults() {
    listEl.innerHTML = "";
    if (!hits.length) {
      var no = el("li", "empty", "No Pokémon matches that.");
      no.setAttribute("role", "presentation");
      listEl.appendChild(no);
      listEl.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }
    hits.forEach(function (p, i) {
      var li = el("li");
      li.id = "opt-" + p.id;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === cursor ? "true" : "false");
      li.appendChild(img(p, null, false));
      var box = el("div");
      box.appendChild(el("div", "nm", p.name));
      box.appendChild(el("div", "no", dex(p.id) + " · " + p.types.map(cap).join(" / ")));
      li.appendChild(box);
      var tail = el("div", "tail");
      var n = E.evolutionsOf(p).length;
      tail.appendChild(el("span", "no", n ? (n > 1 ? n + " evolutions" : "1 evolution") : "no evolution"));
      li.appendChild(tail);
      li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(p); });
      listEl.appendChild(li);
    });
    listEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    listEl.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    cursor = -1;
  }

  function moveCursor(d) {
    if (listEl.hidden || !hits.length) return;
    cursor = (cursor + d + hits.length) % hits.length;
    Array.prototype.forEach.call(listEl.children, function (li, i) {
      li.setAttribute("aria-selected", i === cursor ? "true" : "false");
      if (i === cursor) li.scrollIntoView({block: "nearest"});
    });
    input.setAttribute("aria-activedescendant", "opt-" + hits[cursor].id);
  }

  input.addEventListener("input", function () {
    hits = search(input.value);
    cursor = -1;
    if (input.value.trim()) renderResults(); else closeList();
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveCursor(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveCursor(-1); }
    else if (e.key === "Enter") {
      var p = cursor >= 0 ? hits[cursor] : hits[0];
      if (p) { e.preventDefault(); choose(p); }
    } else if (e.key === "Escape") { closeList(); input.blur(); }
  });
  input.addEventListener("focus", function () { if (input.value.trim() && hits.length) renderResults(); });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search")) closeList();
  });

  function choose(p) {
    input.value = p.name;
    closeList();
    location.hash = p.slug;
    input.blur();
  }

  $("#random").addEventListener("click", function () {
    choose(DEX[Math.floor(Math.random() * DEX.length)]);
  });

  /* ---------------- rendering ---------------- */

  function statRows(o) {
    var wrap = el("div", "stats");
    var peak = E.STATS.reduce(function (m, s) {
      return Math.max(m, o.from.stats[s], o.to.stats[s]);
    }, 0);
    var scale = Math.max(150, peak * 1.05);

    E.STATS.forEach(function (s) {
      var a = o.from.stats[s], b = o.to.stats[s], d = b - a;
      var row = el("div", "stat");
      row.appendChild(el("span", "lab", E.STAT_LABEL[s]));
      row.appendChild(el("span", "v from", a));

      var track = el("div", "track");
      var base = el("i", "base");
      base.style.width = (Math.min(a, b) / scale * 100) + "%";
      track.appendChild(base);
      if (d !== 0) {
        var tail = el("i", d > 0 ? "gain" : "lost");
        tail.style.width = (Math.abs(d) / scale * 100) + "%";
        track.appendChild(tail);
      }
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", E.STAT_LABEL[s] + " " + a + " to " + b);
      row.appendChild(track);

      row.appendChild(el("span", "v to", b));
      row.appendChild(el("span", "d " + (d > 0 ? "up" : d < 0 ? "dn" : "flat"), d === 0 ? "—" : sign(d)));
      wrap.appendChild(row);
    });

    var tot = el("div", "stat total");
    tot.appendChild(el("span", "lab", "Total"));
    tot.appendChild(el("span", "v from", o.from.bst));
    var t = el("div", "track");
    var tb = el("i", "base");
    tb.style.width = (Math.min(o.from.bst, o.to.bst) / 780 * 100) + "%";
    t.appendChild(tb);
    if (o.bstDelta !== 0) {
      var tt = el("i", o.bstDelta > 0 ? "gain" : "lost");
      tt.style.width = (Math.abs(o.bstDelta) / 780 * 100) + "%";
      t.appendChild(tt);
    }
    tot.appendChild(t);
    tot.appendChild(el("span", "v to", o.to.bst));
    tot.appendChild(el("span", "d " + (o.bstDelta > 0 ? "up" : o.bstDelta < 0 ? "dn" : "flat"),
                       o.bstDelta === 0 ? "—" : sign(o.bstDelta)));
    wrap.appendChild(tot);
    return wrap;
  }

  var MULT = {0: "×0", 0.25: "×¼", 0.5: "×½", 2: "×2", 4: "×4"};

  function chip(t, mult, mark) {
    var c = el("span", "chip t-" + t);
    c.appendChild(el("b", null, cap(t)));
    c.appendChild(el("span", "x", MULT[mult] || "×" + mult));
    if (mark) { c.classList.add(mark); c.appendChild(el("span", "tag", mark === "new" ? "new" : "gone")); }
    return c;
  }

  function matchupBlock(o, self) {
    var box = el("div");

    if (o.typeChanged) {
      var shift = el("div", "type-shift");
      o.from.types.forEach(function (t) { shift.appendChild(typeChip(t)); });
      shift.appendChild(el("span", null, "→"));
      o.to.types.forEach(function (t) { shift.appendChild(typeChip(t)); });
      box.appendChild(shift);
    }

    var rows = el("div", "matchups");

    function row(label, types, mults, marker) {
      var r = el("div", "mrow");
      r.appendChild(el("span", null, label));
      var chips = el("div", "chips");
      if (!types.length) chips.appendChild(el("span", "mnone", "None"));
      types.forEach(function (t) { chips.appendChild(chip(t, mults[t], marker(t))); });
      r.appendChild(chips);
      rows.appendChild(r);
    }

    var newer = function (t) { return o.weakGained.indexOf(t) >= 0 ? "new" : null; };
    var after = o.after;
    row("Weak to", after.weak.slice().sort(function (a, b) { return after.all[b] - after.all[a]; }),
        after.all, newer);
    row("Resists", after.resist, after.all,
        function (t) { return o.resistGained.indexOf(t) >= 0 ? "new" : null; });
    row("Immune to", after.immune, after.all,
        function (t) { return o.immuneGained.indexOf(t) >= 0 ? "new" : null; });

    if (o.weakLost.length) {
      var r = el("div", "mrow");
      r.appendChild(el("span", null, "No longer weak"));
      var chips = el("div", "chips");
      o.weakLost.forEach(function (t) { chips.appendChild(chip(t, o.before.all[t], "gone")); });
      r.appendChild(chips);
      rows.appendChild(r);
    }

    box.appendChild(rows);
    if (!o.typeChanged && !self) {
      var same = el("p", "mnone");
      same.textContent = "Typing does not change, so every matchup stays exactly the same.";
      same.style.marginTop = "14px";
      box.appendChild(same);
    }
    return box;
  }

  function facts(o) {
    var d = el("dl", "facts");
    function add(label, value, sub) {
      var f = el("div", "fact");
      f.appendChild(el("dt", null, label));
      var dd = el("dd", null, value);
      if (sub) { var s = el("small", null, sub); dd.appendChild(s); }
      f.appendChild(dd);
      d.appendChild(f);
    }
    var m = function (dm) { return (dm / 10).toFixed(1) + " m"; };
    var kg = function (hg) { return (hg / 10).toFixed(1) + " kg"; };

    var wasRole = E.roleOf(o.from);
    add("Battle role", o.role, wasRole === o.role ? "Unchanged from " + o.from.name
                                                  : o.from.name + " was: " + wasRole);
    if (o.to.baseExp != null && o.from.baseExp != null)
      add("Base experience", String(o.to.baseExp),
          sign(o.to.baseExp - o.from.baseExp) + " — it yields more EXP when defeated");
    add("Height", m(o.to.height), m(o.from.height) + " before");
    add("Weight", kg(o.to.weight), kg(o.from.weight) + " before");
    add("Abilities", o.to.abilities.join(", ") || "—",
        o.to.hidden ? "Hidden: " + o.to.hidden : null);
    return d;
  }

  function optionPanel(o, branching) {
    var wrap = el("div", "option");

    var card = el("section", "card");
    var head = el("div", "opt-head");
    head.appendChild(el("h3", null, o.from.name + " → " + o.to.name));
    var tierPill = {strong: ["up", "Clear upgrade"], yes: ["up", "Worth it"],
                    tradeoff: ["warn", "Trade-off"], caution: ["down", "Think twice"]}[o.tier];
    head.appendChild(el("span", "pill " + tierPill[0], tierPill[1]));
    head.appendChild(el("span", "pill", o.role));
    card.appendChild(head);

    var ledger = el("div", "ledger");
    var gain = el("div", "gain");
    gain.appendChild(el("h4", null, "What you gain"));
    if (o.pros.length) {
      var ul = el("ul");
      o.pros.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      gain.appendChild(ul);
    } else gain.appendChild(el("p", "none", "Nothing the data can point to."));
    ledger.appendChild(gain);

    var loss = el("div", "loss");
    loss.appendChild(el("h4", null, "What you give up"));
    if (o.cons.length) {
      var ul2 = el("ul");
      o.cons.forEach(function (t) { ul2.appendChild(el("li", null, t)); });
      loss.appendChild(ul2);
    } else loss.appendChild(el("p", "none", "Nothing — this one is a straight upgrade."));
    ledger.appendChild(loss);
    card.appendChild(ledger);
    wrap.appendChild(card);

    var s = el("section", "card");
    s.appendChild(el("h3", null, "Base stats · " + o.from.name + " vs " + o.to.name));
    s.appendChild(statRows(o));
    wrap.appendChild(s);

    var t = el("section", "card");
    t.appendChild(el("h3", null, "Defensive matchups as " + o.to.name));
    t.appendChild(matchupBlock(o));
    wrap.appendChild(t);

    var f = el("section", "card");
    f.appendChild(el("h3", null, "The rest of the numbers"));
    f.appendChild(facts(o));
    wrap.appendChild(f);

    if (branching) {
      var note = el("section", "card");
      note.appendChild(el("h3", null, "Before you commit"));
      var pp = el("p");
      pp.style.margin = "0";
      pp.style.color = "var(--ink-dim)";
      pp.textContent = o.from.name + " can only become one of its options, and the split is permanent " +
        "without breeding or catching another. Compare the tabs above before you use the stone, trade or " +
        "level it up.";
      note.appendChild(pp);
      wrap.appendChild(note);
    }
    return wrap;
  }

  /* Full lineage drawn from the first form, with the current one marked. */
  function chainView(p) {
    var root = E.rootOf(p);
    var line = el("ol", "line");

    function node(x) {
      var n = el("button", "node" + (x.id === p.id ? " here" : ""));
      n.type = "button";
      n.appendChild(img(x, null, false));
      n.appendChild(el("span", "nm", x.name));
      n.appendChild(el("span", "bs", x.bst + " BST"));
      if (x.id === p.id) { n.disabled = true; n.setAttribute("aria-current", "true"); }
      else n.addEventListener("click", function () { choose(x); });
      return n;
    }

    function walk(x) {
      var li = el("li");
      li.appendChild(node(x));
      line.appendChild(li);
      var kids = E.evolutionsOf(x);
      if (!kids.length) return;
      var arrow = el("li", "arrow", "→");
      arrow.setAttribute("aria-hidden", "true");
      line.appendChild(arrow);
      if (kids.length === 1) { walk(kids[0]); return; }
      var set = el("li");
      var box = el("div", "branchset" + (kids.length > 3 ? " wide" : ""));
      kids.forEach(function (k) { box.appendChild(node(k)); });
      set.appendChild(box);
      line.appendChild(set);
    }

    walk(root);
    return line;
  }

  function render(p) {
    var a = E.analyse(p);
    var out = $("#out");
    document.body.classList.add("has-result");
    out.innerHTML = "";
    document.documentElement.style.setProperty("--accent", p.color);
    document.title = "Should I evolve " + p.name + "? · Pokémon evolution advisor";

    var tier = a.kind === "none" ? "none" : a.kind === "branch" ? "branch" : a.best.tier;
    var badge = {strong: "Yes", yes: "Yes", tradeoff: "Yes, with a catch",
                 caution: "Maybe not", branch: "You choose", none: "Nothing to decide"}[tier];

    var v = el("section", "card verdict tier-" + tier);
    var subj = el("div", "subject");
    subj.appendChild(img(p, "art", true));
    subj.appendChild(el("p", "dex", dex(p.id) + " · Gen " + p.gen + " · Stage " +
                        (E.stageOf(p) + 1) + " of " + (E.stageOf(p) + 1 + maxDepth(p))));
    subj.appendChild(el("h2", null, p.name));
    var tl = el("p");
    tl.style.display = "flex"; tl.style.gap = "6px"; tl.style.justifyContent = "center"; tl.style.margin = "0";
    p.types.forEach(function (t) { tl.appendChild(typeChip(t)); });
    subj.appendChild(tl);
    var sl = el("p", "stats-line");
    sl.innerHTML = "<b>" + p.bst + "</b> total base stats · " + esc(E.roleOf(p));
    subj.appendChild(sl);
    v.appendChild(subj);

    var ans = el("div", "answer");
    ans.appendChild(el("p", "badge", badge));
    ans.appendChild(el("h3", null, a.headline));
    ans.appendChild(el("p", null, a.detail));
    v.appendChild(ans);
    out.appendChild(v);

    var chain = el("section", "card");
    chain.appendChild(el("h3", null, E.evolutionsOf(p).length || p.from ? "Evolution line" : "No evolution line"));
    chain.appendChild(chainView(p));
    out.appendChild(chain);

    if (!a.options.length) {
      var end = el("section", "card");
      end.appendChild(el("h3", null, "What you are working with"));
      var pe = el("p");
      pe.style.cssText = "margin:0;color:var(--ink-dim);max-width:66ch";
      pe.textContent = p.name + " sits at " + p.bst + " total base stats as a " +
        E.roleOf(p).toLowerCase() + ". Its best stat is " + bestStatName(p) +
        " at " + p.stats[bestStat(p)] + ", and its weakest is " + worstStatName(p) +
        " at " + p.stats[worstStat(p)] + " — build the moveset around the first and cover the second.";
      end.appendChild(pe);
      var mp = el("div");
      var mh = el("h3", null, "Defensive matchups");
      mh.style.marginTop = "26px";
      end.appendChild(mh);
      mp.appendChild(matchupBlock(E.compare(p, p), true));
      end.appendChild(mp);
      out.appendChild(end);
      window.scrollTo({top: 0, behavior: "smooth"});
      return;
    }

    if (a.options.length > 1) {
      var tabs = el("div", "tabs");
      tabs.setAttribute("role", "tablist");
      var panel = el("div");
      a.options.forEach(function (o, i) {
        var b = el("button", "tab");
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", i === 0 ? "true" : "false");
        b.appendChild(img(o.to, null, false));
        b.appendChild(el("span", null, o.to.name));
        b.appendChild(el("span", "bst", sign(o.bstDelta)));
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(tabs.children, function (x) { x.setAttribute("aria-selected", "false"); });
          b.setAttribute("aria-selected", "true");
          panel.innerHTML = "";
          panel.appendChild(optionPanel(o, true));
        });
        tabs.appendChild(b);
      });
      out.appendChild(tabs);
      panel.appendChild(optionPanel(a.options[0], true));
      out.appendChild(panel);
    } else {
      out.appendChild(optionPanel(a.options[0], false));
    }

    window.scrollTo({top: 0, behavior: "smooth"});
  }

  function maxDepth(p) {
    var paths = E.futurePaths(p);
    return paths.reduce(function (m, x) { return Math.max(m, x.length); }, 0);
  }
  function bestStat(p) {
    return E.STATS.reduce(function (a, b) { return p.stats[b] > p.stats[a] ? b : a; });
  }
  function worstStat(p) {
    return E.STATS.reduce(function (a, b) { return p.stats[b] < p.stats[a] ? b : a; });
  }
  var bestStatName = function (p) { return E.STAT_LABEL[bestStat(p)]; };
  var worstStatName = function (p) { return E.STAT_LABEL[worstStat(p)]; };

  /* ---------------- intro picks ---------------- */

  var PICKS = [
    ["scyther", "Gains attack and armour, loses 40 Speed and gets a 4× fire weakness — for zero net stats."],
    ["eevee", "Eight ways to go, and the split is permanent. The classic “it depends”."],
    ["magikarp", "The biggest jump in the game: +340 base stats. Read the small print anyway."],
    ["nincada", "One evolution costs it 30 base stats and 30 HP. Sometimes the answer really is no."]
  ];

  function renderPicks() {
    var box = $("#picks");
    var bySlug = {};
    DEX.forEach(function (p) { bySlug[p.slug] = p; });
    PICKS.forEach(function (row) {
      var p = bySlug[row[0]];
      if (!p) return;
      var b = el("button", "pick");
      b.type = "button";
      b.style.setProperty("--pc", p.color);
      b.appendChild(img(p, null, true));
      b.appendChild(el("span", "nm", p.name));
      b.appendChild(el("span", "why", row[1]));
      b.addEventListener("click", function () { choose(p); });
      box.appendChild(b);
    });
  }

  /* ---------------- routing ---------------- */

  function fromHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, "")).toLowerCase();
    if (!h) return null;
    var hit = null;
    DEX.forEach(function (p) { if (!hit && (p.slug === h || String(p.id) === h)) hit = p; });
    return hit;
  }

  function route() {
    var p = fromHash();
    if (p) { input.value = p.name; render(p); }
    else {
      document.body.classList.remove("has-result");
      input.value = "";
      document.title = "Should I Evolve This Pokémon?";
      document.documentElement.style.setProperty("--accent", "#6ea8fe");
      $("#out").innerHTML =
        '<section class="intro"><h2>Start with one of the interesting ones</h2>' +
        '<p class="sub">These four are where the answer is not simply “yes”.</p>' +
        '<div class="picks" id="picks"></div></section>';
      renderPicks();
    }
  }

  /* Point the footer link at the repository this page is served from, so the
     link is correct on any fork without editing the HTML. */
  (function () {
    var a = document.getElementById("repo-link");
    if (!a) return;
    var user = location.hostname.match(/^([\w-]+)\.github\.io$/);
    if (user) {
      var seg = location.pathname.split("/").filter(Boolean)[0];
      a.href = "https://github.com/" + user[1] + "/" + (seg || user[1] + ".github.io");
    } else {
      a.replaceWith(document.createTextNode("Built for the Pokémon case"));
    }
  })();

  window.addEventListener("hashchange", route);
  renderPicks();
  route();
})();
