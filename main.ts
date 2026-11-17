// Hands this entry in. Node 22, standard library only, no install and no build:
// it copies the frontend (app/) and the screenshots beside this file into the
// output directory, then writes dossier.json with the kit's own library, so the
// judge's outline and the scorer's rebuild describe exactly the same bytes.
//
// The frontend itself is plain static files: app/index.html plus ES modules and
// one stylesheet, reading make.fun's public API from the browser. Nothing here
// touches the network; this program only copies files and builds one document.
//
// Serve the app locally with `node serve.ts` (http://localhost:8080), and run
// this hand-in against a folder you can look at:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// vendor/makefun-frontend.ts is the kit's copy of the dossier library and must
// stay byte for byte as it is.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });

// The app first: the files a browser loads, unchanged.
cpSync(join(repo, 'app'), join(outDir, 'app'), { recursive: true });

// Then the three screenshots the judge sees before any text, the cover first by name.
const shots = join(repo, 'screenshots');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });

// The same limits the scorer applies: a text cap of 160 KiB, three screenshots of
// at most 256 KiB each, and the app caps that would otherwise let an entry through
// that the gate then refuses (993 files and directories, 16 MiB in all).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
