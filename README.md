# Should I Evolve This Pokémon?

A small static site that answers one question for any of the 721 Pokémon in the supplied dataset:
**should you evolve it, and what do you give up if you do?**

- **Live site:** _add the GitHub Pages URL here after the first deploy_
- **Repository:** _add the repository URL here_

## Why the site is built this way

Almost every evolution raises the total base stats, so "does it get stronger?" is a question that
answers itself and helps nobody. The interesting part is the cost, and the data can actually show it:

| Case | What the site surfaces |
| --- | --- |
| Scyther → Scizor | +20 Attack and +20 Defense, but **zero** net stats, −40 Speed and a new 4× fire weakness |
| Magikarp → Gyarados | The biggest jump in the game (+340), and a 4× electric weakness that comes with it |
| Nincada → Shedinja | The only evolution in the set that **loses** total base stats (−30, and HP falls to 1) |
| Eevee | Eight permanent options, compared side by side |
| Mewtwo | Nothing to decide — the site says so instead of inventing an answer |

Across the dataset, 38 evolutions drop at least one stat and 65 change typing. Those are the cases
where a verdict is worth having.

## How the verdict is computed

Everything comes from `data/pokemon.csv` — no external API calls for data.

1. **Evolution lines** are rebuilt from `evolves_from_species_id` and `evolution_chain_id`.
2. **Stat deltas** are computed per stat and for the total, and flagged when a drop is meaningful
   (≥ 15 points, with Speed called out separately because losing the first move matters most).
3. **Defensive typing** is run through the Generation VI type chart in `assets/engine.js`: new
   weaknesses, shed weaknesses, new resistances and immunities, and any 4× weakness picked up.
4. **Abilities** gained and lost are diffed.
5. A severity score turns that into one of four verdicts — *clear upgrade*, *worth it*,
   *trade-off*, *think twice* — or, for a branching line, a side-by-side comparison instead of a
   yes/no.

## What it deliberately does not claim

The dataset has no levels, evolution methods, moves, held items or catch rates. So the site will not
tell you which stone to use, what a trade requires, or that a Pokémon learns a move earlier
unevolved. It answers the part the numbers can answer and says as much in the footer.

## Data notes

- 811 rows in the CSV; **721** are kept. The 90 dropped rows have no `evolution_chain_id` because
  they are alternate forms — mega evolutions, Rotom appliances, Pikachu cosplay outfits — which are
  forms, not evolutions, and would corrupt the chains.
- `url_image` is a bare filename (`1.png`) with no host. Three rows (Diancie, Hoopa, Volcanion) have
  `NA` but follow the same `id.png` convention, so the filename is derived for them.
- Images are served from the [PokeAPI sprite set](https://github.com/PokeAPI/sprites) via jsDelivr,
  matched on that id. Official artwork falls back to the small sprite, then hides itself.

## Project layout

```
index.html          markup and the copy in the footer
assets/style.css    all styling; per-Pokémon accent colour comes from color_1 in the CSV
assets/engine.js    type chart, evolution graph, comparison and verdict logic (no DOM)
assets/app.js       search, hash routing, rendering
assets/data.js      generated — window.POKEDEX
build_data.py       CSV → data.js
data/pokemon.csv    the supplied dataset, unmodified
```

## Running it locally

No build step and no dependencies. Any static server works:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To regenerate `assets/data.js` after changing the CSV:

```bash
python3 build_data.py
```

## Deploying to GitHub Pages

Push to `main`, then in the repository go to **Settings → Pages** and set
**Source: Deploy from a branch**, **Branch: `main`**, **Folder: `/ (root)`**. The site is live at
`https://<username>.github.io/<repository>/` within a minute or two. `.nojekyll` is present so
GitHub serves the files as-is.

## Accessibility and browser support

The search field is a proper ARIA combobox with arrow-key and Enter navigation, every interactive
element is a real `<button>`, the stat bars carry text labels for screen readers, and the layout
reflows to a single column below 780px. It is plain ES5-compatible JavaScript with no framework and
no build tooling.

## Time and cost

_Fill these in before submitting — they are part of the grading._

- **Time spent:** ~__ hours.
- **Cost:** Built in one session with Claude Code (Claude Opus). Approximate usage: __ .
  No paid APIs, no hosting cost — GitHub Pages is free for public repositories.

## Credits

Pokémon data and names are © Nintendo / Creatures Inc. / GAME FREAK inc. This is a non-commercial
student project.
