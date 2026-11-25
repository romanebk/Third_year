// Tiny animated sequence diagram for the network slides.
// Needs pause.js (for sleep). Usage:
//   runSeq(el, { lanes: ['Client', 'L', 'r2'], steps: [ { from: 0, to: 1, label: 'LOGIN', kind: 'tcp' }, ... ] })
// kind: tcp | udp | proc | bad | note   (note: { at: laneIndex, label })

const SEQ_COLORS = {
    tcp:  '#8899EE',
    udp:  '#00FFAA',
    proc: '#FFB000',
    bad:  '#FF4400',
    note: '#9a9aae',
};

function seqBuild(el, cfg) {
    el.innerHTML = '';
    el.classList.add('seq');
    el.style.setProperty('--lanes', cfg.lanes.length);

    const head = document.createElement('div');
    head.className = 'seq-head';
    cfg.lanes.forEach(l => {
        const h = document.createElement('div');
        h.className = 'seq-lane';
        h.innerHTML = l;
        head.appendChild(h);
    });
    el.appendChild(head);

    const body = document.createElement('div');
    body.className = 'seq-body';
    cfg.lanes.forEach((_, i) => {
        const line = document.createElement('div');
        line.className = 'seq-life';
        line.style.left = `calc(${(i + 0.5) / cfg.lanes.length * 100}% - 1px)`;
        body.appendChild(line);
    });
    el.appendChild(body);

    const rows = cfg.steps.map(s => {
        const r = document.createElement('div');
        r.className = 'seq-row';
        const n = cfg.lanes.length;
        const color = SEQ_COLORS[s.kind] || '#cdd6f4';
        if (s.kind === 'note') {
            const c = (s.at + 0.5) / n * 100;
            // notes on the first lane start at its lifeline instead of centring (no overflow)
            const tx = s.at === 0 ? '-12%' : '-50%';
            r.innerHTML = `<div class="seq-note" style="left:${c}%;color:${color};transform:translate(${tx},-50%)">${s.label}</div>`;
        } else {
            const a = (s.from + 0.5) / n * 100, b = (s.to + 0.5) / n * 100;
            const left = Math.min(a, b), width = Math.abs(b - a);
            const dir = b > a ? 'r' : 'l';
            r.innerHTML =
                `<div class="seq-arrow ${dir} ${s.kind}" style="left:${left}%;width:${width}%;--c:${color}">` +
                `<span class="seq-label">${s.label}</span></div>`;
        }
        body.appendChild(r);
        return r;
    });
    return rows;
}

async function runSeq(el, cfg, onStep) {
    const rows = seqBuild(el, cfg);
    for (let i = 0; i < rows.length; i++) {
        await sleep(cfg.steps[i].wait ?? 1400);
        rows[i].classList.add('on');
        if (onStep) onStep(i, cfg.steps[i]);
    }
}
