/* tools/tune.js — grid-search the solver's move-ordering weights.
   Usage: node --stack-size=8000 tools/tune.js [deals] [nodeBudget]           */
const S = require('../js/solver.js');
const D = require('../js/deal.js');

const N = parseInt(process.argv[2] || '120', 10);
const BUDGET = parseInt(process.argv[3] || '120000', 10);

const variants = {
  'A greedy-foundation': { tfExpose:160, tfPlain:100, ttReveal:90, ttWhole:55, ttPart:40, wt:50, wf:85, ft:5, drawPenalty:1 },
  'B reveal-first':      { tfExpose:95,  tfPlain:30,  ttReveal:100,ttWhole:60, ttPart:50, wt:70, wf:25, ft:5, drawPenalty:1 },
  'C balanced':          { tfExpose:95,  tfPlain:80,  ttReveal:100,ttWhole:60, ttPart:45, wt:65, wf:70, ft:5, drawPenalty:1 },
  'D reveal>>found':     { tfExpose:120, tfPlain:70,  ttReveal:140,ttWhole:60, ttPart:45, wt:65, wf:60, ft:5, drawPenalty:1 },
  'E found-heavy':       { tfExpose:200, tfPlain:150, ttReveal:120,ttWhole:60, ttPart:45, wt:70, wf:140,ft:5, drawPenalty:1 },
  'F column-heavy':      { tfExpose:160, tfPlain:100, ttReveal:120,ttWhole:130,ttPart:45, wt:60, wf:85, ft:5, drawPenalty:1 },
  'G draw-averse':       { tfExpose:160, tfPlain:100, ttReveal:90, ttWhole:55, ttPart:40, wt:50, wf:85, ft:5, drawPenalty:8 },
};

for (const [name, w] of Object.entries(variants)) {
  Object.assign(S.weights, w);
  let win=0, uns=0, unk=0, nodes=0;
  const t0 = Date.now();
  for (let seed=1; seed<=N; seed++) {
    const r = S.solve(D.dealFromSeed(seed), { maxNodes: BUDGET });
    nodes += r.nodes;
    if (r.result==='win') win++; else if (r.result==='unsolvable') uns++; else unk++;
  }
  const dt=(Date.now()-t0)/1000;
  console.log(`${name.padEnd(22)} win ${String(win).padStart(3)}/${N} (${(100*win/N).toFixed(0)}%)  unsolv ${String(uns).padStart(2)}  unknown ${String(unk).padStart(3)}  ${dt.toFixed(1)}s`);
}
