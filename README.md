# X3 Regulation Watch

**A free daily tracker of federal safety rule changes.** Every amendment to the FMCSA, OSHA, PHMSA and Coast Guard regulations from the official eCFR, plus new final rules, proposed rules and open comment periods from the Federal Register, with an Atom feed for each.

**[See what changed →](https://x3allamerican.github.io/x3-regulation-watch/)** · **[Atom feed](https://x3allamerican.github.io/x3-regulation-watch/feed.xml)**

Built and maintained by **X3**: [X3 Fleet Safety](https://x3fleetsafety.com) · [X3 Workplace Safety](https://x3workplacesafety.com) · [X3 Pipeline](https://x3pipeline.com) · [X3 Maritime](https://x3maritime.com).

## Feeds

| Group | Watching | Feed |
|---|---|---|
| Fleet safety (FMCSA) | 49 CFR 40, 380, 382, 383, 385, 387, 390-393, 395, 396 | [fleet.xml](https://x3allamerican.github.io/x3-regulation-watch/fleet.xml) |
| Workplace safety (OSHA) | 29 CFR 1904, 1910, 1926 | [workplace.xml](https://x3allamerican.github.io/x3-regulation-watch/workplace.xml) |
| Pipeline and hazmat (PHMSA) | 49 CFR 190-199, 107, 171-180 | [pipeline.xml](https://x3allamerican.github.io/x3-regulation-watch/pipeline.xml) |
| Maritime (Coast Guard) | 46 CFR 10-16, 136-144 (Subchapter M); 33 CFR 96, 101, 104, 155, 164 | [maritime.xml](https://x3allamerican.github.io/x3-regulation-watch/maritime.xml) |

Everything together: [feed.xml](https://x3allamerican.github.io/x3-regulation-watch/feed.xml). Raw data: [data.json](https://x3allamerican.github.io/x3-regulation-watch/data.json).

## How it works

A GitHub Action runs `scripts/update.mjs` every morning. It asks the eCFR versioner API for substantive amendments to each watched part in the last 365 days, and the Federal Register API for final and proposed rules from each agency in the last 120 days that touch a watched part (so local Coast Guard safety zones and bridge notices are left out). It writes `docs/data.json` and the Atom feeds, and commits them if anything changed. No dependencies.

Watch other parts by editing `scripts/watch.json` in a fork. Run it yourself with `node scripts/update.mjs`.

## Limits

The eCFR is an editorial compilation, not the official legal edition. Dates of amendments are the dates they took effect in the eCFR. Not legal advice.

## License

MIT. Data is U.S. government work.
