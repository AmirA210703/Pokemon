/* Evolution analysis. Pure functions over the dataset in data.js - no DOM here. */
(function (global) {
  "use strict";

  var TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison",
               "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];

  /* Gen VI type chart, attacker -> { defender: multiplier }. Anything absent is 1x. */
  var CHART = {
    normal:   {rock:.5, ghost:0, steel:.5},
    fire:     {fire:.5, water:.5, grass:2, ice:2, bug:2, rock:.5, dragon:.5, steel:2},
    water:    {fire:2, water:.5, grass:.5, ground:2, rock:2, dragon:.5},
    electric: {water:2, electric:.5, grass:.5, ground:0, flying:2, dragon:.5},
    grass:    {fire:.5, water:2, grass:.5, poison:.5, ground:2, flying:.5, bug:.5, rock:2, dragon:.5, steel:.5},
    ice:      {fire:.5, water:.5, grass:2, ice:.5, ground:2, flying:2, dragon:2, steel:.5},
    fighting: {normal:2, ice:2, poison:.5, flying:.5, psychic:.5, bug:.5, rock:2, ghost:0, dark:2, steel:2, fairy:.5},
    poison:   {grass:2, poison:.5, ground:.5, rock:.5, ghost:.5, steel:0, fairy:2},
    ground:   {fire:2, electric:2, grass:.5, poison:2, flying:0, bug:.5, rock:2, steel:2},
    flying:   {electric:.5, grass:2, fighting:2, bug:2, rock:.5, steel:.5},
    psychic:  {fighting:2, poison:2, psychic:.5, dark:0, steel:.5},
    bug:      {fire:.5, grass:2, fighting:.5, poison:.5, flying:.5, psychic:2, ghost:.5, dark:2, steel:.5, fairy:.5},
    rock:     {fire:2, ice:2, fighting:.5, ground:.5, flying:2, bug:2, steel:.5},
    ghost:    {normal:0, psychic:2, ghost:2, dark:.5},
    dragon:   {dragon:2, steel:.5, fairy:0},
    dark:     {fighting:.5, psychic:2, ghost:2, dark:.5, fairy:.5},
    steel:    {fire:.5, water:.5, electric:.5, ice:2, rock:2, steel:.5, fairy:2},
    fairy:    {fire:.5, fighting:2, poison:.5, dragon:2, dark:2, steel:.5}
  };

  /* "a, b and c" reads better than "a, b, c" in prose. */
  function list(arr) {
    if (arr.length <= 1) return arr.join("");
    return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
  }

  /* Lower-case the first letter unless the phrase starts with a proper noun or digit. */
  function lower1(s) {
    if (!s) return "";
    return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }

  var STATS = ["hp","attack","defense","special_attack","special_defense","speed"];
  var STAT_LABEL = {hp:"HP", attack:"Attack", defense:"Defense",
                    special_attack:"Sp. Atk", special_defense:"Sp. Def", speed:"Speed"};

  /* How every attacking type fares against a defender's type combo. */
  function matchups(defTypes) {
    var out = {};
    TYPES.forEach(function (atk) {
      var m = 1;
      defTypes.forEach(function (def) {
        var row = CHART[atk];
        if (row && row[def] !== undefined) m *= row[def];
      });
      out[atk] = m;
    });
    return out;
  }

  function profile(defTypes) {
    var m = matchups(defTypes), p = {weak: [], quadWeak: [], resist: [], immune: [], all: m};
    TYPES.forEach(function (t) {
      if (m[t] === 0) p.immune.push(t);
      else if (m[t] >= 4) { p.weak.push(t); p.quadWeak.push(t); }
      else if (m[t] > 1) p.weak.push(t);
      else if (m[t] < 1) p.resist.push(t);
    });
    return p;
  }

  var byId = {}, childrenOf = {};

  function index(dex) {
    dex.forEach(function (p) { byId[p.id] = p; childrenOf[p.id] = []; });
    dex.forEach(function (p) { if (p.from && childrenOf[p.from]) childrenOf[p.from].push(p); });
    Object.keys(childrenOf).forEach(function (k) {
      childrenOf[k].sort(function (a, b) { return a.id - b.id; });
    });
  }

  var get = function (id) { return byId[id]; };
  var evolutionsOf = function (p) { return childrenOf[p.id] || []; };
  var preEvolutionOf = function (p) { return p.from ? byId[p.from] : null; };

  /* Full lineage from the first form down to every terminal form. */
  function rootOf(p) { var c = p; while (c.from && byId[c.from]) c = byId[c.from]; return c; }

  function stageOf(p) { var n = 0, c = p; while (c.from && byId[c.from]) { c = byId[c.from]; n++; } return n; }

  /* Every path that continues past `p`, e.g. Charmeleon -> [[Charizard]]. */
  function futurePaths(p) {
    var kids = evolutionsOf(p);
    if (!kids.length) return [];
    var paths = [];
    kids.forEach(function (k) {
      var rest = futurePaths(k);
      if (!rest.length) paths.push([k]);
      else rest.forEach(function (r) { paths.push([k].concat(r)); });
    });
    return paths;
  }

  function roleOf(p) {
    var s = p.stats;
    var best = STATS.reduce(function (a, b) { return s[b] > s[a] ? b : a; }, "hp");
    var phys = s.attack, spec = s.special_attack;
    var bulk = s.hp + s.defense + s.special_defense;
    if (best === "speed" && Math.max(phys, spec) >= 90) return "Fast attacker";
    if (bulk >= 260 && Math.max(phys, spec) < 100) return "Wall";
    if (phys >= spec + 20) return "Physical attacker";
    if (spec >= phys + 20) return "Special attacker";
    if (best === "hp" || best === "defense" || best === "special_defense") return "Bulky";
    return "All-rounder";
  }

  /* Compare one Pokemon against one of its evolutions. */
  function compare(from, to) {
    var deltas = {}, drops = [], gains = [];
    STATS.forEach(function (s) {
      var d = to.stats[s] - from.stats[s];
      deltas[s] = d;
      if (d < 0) drops.push({stat: s, delta: d});
      if (d > 0) gains.push({stat: s, delta: d});
    });
    drops.sort(function (a, b) { return a.delta - b.delta; });
    gains.sort(function (a, b) { return b.delta - a.delta; });

    var before = profile(from.types), after = profile(to.types);
    var weakGained = after.weak.filter(function (t) { return before.weak.indexOf(t) < 0; });
    var weakLost = before.weak.filter(function (t) { return after.weak.indexOf(t) < 0; });
    var quadGained = after.quadWeak.filter(function (t) { return before.quadWeak.indexOf(t) < 0; });
    var resistGained = after.resist.filter(function (t) { return before.resist.indexOf(t) < 0; });
    var immuneGained = after.immune.filter(function (t) { return before.immune.indexOf(t) < 0; });

    var abilLost = from.abilities.filter(function (a) { return to.abilities.indexOf(a) < 0; });
    var abilGained = to.abilities.filter(function (a) { return from.abilities.indexOf(a) < 0; });

    var typeChanged = from.types.join("/") !== to.types.join("/");

    /* Notes: the honest caveats a trainer should weigh, strongest first. */
    var pros = [], cons = [];
    var bstDelta = to.bst - from.bst;

    if (bstDelta > 0) pros.push("+" + bstDelta + " total base stats (" + from.bst + " \u2192 " + to.bst + ")");
    else if (bstDelta === 0) cons.push("No net stat gain \u2014 the total stays at " + to.bst);
    else cons.push(bstDelta + " total base stats (" + from.bst + " \u2192 " + to.bst + ")");

    gains.slice(0, 2).forEach(function (g) {
      if (g.delta >= 20) pros.push(STAT_LABEL[g.stat] + " jumps +" + g.delta);
    });
    drops.forEach(function (d) {
      if (d.stat === "speed" && d.delta <= -15)
        cons.push("Speed falls " + d.delta + " (" + from.stats.speed + " \u2192 " + to.stats.speed +
                  ") \u2014 it moves second far more often");
      else if (d.delta <= -15)
        cons.push(STAT_LABEL[d.stat] + " drops " + d.delta +
                  " (" + from.stats[d.stat] + " \u2192 " + to.stats[d.stat] + ")");
    });

    /* A type it is now immune to reads as an immunity, not as a shed weakness. */
    var shed = weakLost.filter(function (t) { return immuneGained.indexOf(t) < 0; });
    var plainWeak = weakGained.filter(function (t) { return quadGained.indexOf(t) < 0; });

    if (quadGained.length)
      cons.push("Picks up a 4\u00d7 weakness to " + list(quadGained));
    if (plainWeak.length)
      cons.push("New weakness" + (plainWeak.length > 1 ? "es" : "") + ": " + plainWeak.join(", "));
    if (immuneGained.length)
      pros.push("Becomes immune to " + list(immuneGained));
    if (shed.length)
      pros.push("Sheds its weakness to " + list(shed));
    if (!immuneGained.length && resistGained.length >= 3)
      pros.push("Gains " + resistGained.length + " new resistances");
    if (abilLost.length)
      cons.push("Loses the abilit" + (abilLost.length > 1 ? "ies " : "y ") + list(abilLost));
    if (abilGained.length)
      pros.push("Gains the abilit" + (abilGained.length > 1 ? "ies " : "y ") + list(abilGained));

    /* Verdict for this single step. */
    var severity = 0;
    if (bstDelta <= 0) severity += 3;
    if (quadGained.length) severity += 3;
    if (deltas.speed <= -20) severity += 2;
    else if (deltas.speed <= -10) severity += 1;
    if (weakGained.length > weakLost.length) severity += 1;
    if (abilLost.length && !abilGained.length) severity += 1;

    var tier;
    if (bstDelta <= 0 && severity >= 4) tier = "caution";
    else if (severity >= 3) tier = "tradeoff";
    else if (bstDelta >= 80) tier = "strong";
    else tier = "yes";

    return {
      from: from, to: to, deltas: deltas, bstDelta: bstDelta,
      drops: drops, gains: gains,
      before: before, after: after,
      weakGained: weakGained, weakLost: weakLost, quadGained: quadGained,
      resistGained: resistGained, immuneGained: immuneGained,
      abilGained: abilGained, abilLost: abilLost,
      typeChanged: typeChanged, pros: pros, cons: cons,
      tier: tier, severity: severity, role: roleOf(to)
    };
  }

  /* The top-level answer for "should I evolve this one?" */
  function analyse(p) {
    var options = evolutionsOf(p).map(function (e) { return compare(p, e); });

    if (!options.length) {
      var pre = preEvolutionOf(p);
      return {
        pokemon: p, options: [], kind: "none",
        headline: p.name + " has nothing to evolve into",
        detail: pre
          ? p.name + " is the final form of its line — it already evolved from " + pre.name +
            ". There is no further evolution in this dataset, so the question is settled."
          : p.name + " does not evolve at all. Its base stats are what you get, so build around them."
      };
    }

    if (options.length > 1) {
      /* Branching line: rank the options rather than answering yes/no. */
      var ranked = options.slice().sort(function (a, b) { return b.bstDelta - a.bstDelta; });
      return {
        pokemon: p, options: options, kind: "branch", best: ranked[0],
        headline: "Yes — but " + p.name + " makes you choose",
        detail: p.name + " can evolve into " + options.length + " different Pokémon, and the choice is " +
                "usually permanent. They are compared side by side below; pick the one whose role you need."
      };
    }

    var o = options[0];
    var deeper = futurePaths(p).filter(function (path) { return path.length > 1; });
    var head, detail;

    if (o.tier === "caution") {
      head = "Think twice before evolving " + p.name;
      detail = o.to.name + " is not a straight upgrade. The catch: " + lower1(o.cons[0]) + ".";
    } else if (o.tier === "tradeoff") {
      head = "Yes, but " + o.to.name + " comes at a price";
      detail = "You gain " + (o.bstDelta > 0 ? "+" + o.bstDelta + " total base stats" : "a new form") +
               ". The cost: " + lower1(o.cons[0]) + ".";
    } else if (!o.cons.length) {
      head = "Yes \u2014 evolving is a clear upgrade";
      detail = o.to.name + " is stronger across the board: +" + o.bstDelta +
               " total base stats, and the data shows nothing given up in return.";
    } else {
      head = "Yes \u2014 evolve it";
      detail = o.to.name + " gains +" + o.bstDelta + " total base stats. Minor cost: " +
               lower1(o.cons[0]) + ".";
    }

    if (deeper.length === 1 && deeper[0].length > 1) {
      detail += " " + p.name + " also has a third stage: " +
                deeper[0].map(function (x) { return x.name; }).join(" → ") + ".";
    }

    return {pokemon: p, options: options, kind: "single", best: o, headline: head, detail: detail};
  }

  global.Engine = {
    TYPES: TYPES, STATS: STATS, STAT_LABEL: STAT_LABEL,
    index: index, get: get, profile: profile, matchups: matchups,
    evolutionsOf: evolutionsOf, preEvolutionOf: preEvolutionOf,
    rootOf: rootOf, stageOf: stageOf, futurePaths: futurePaths,
    roleOf: roleOf, compare: compare, analyse: analyse
  };
})(window);
