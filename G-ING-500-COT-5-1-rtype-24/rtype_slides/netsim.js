// Two-player top-down shooter network simulator.
// Shows client-side prediction + reconciliation and snapshot interpolation.
// Needs pause.js (global `paused`). Usage: NetSim.mount(el, { tick, lat: [a, b], pred: [a, b], interp: [a, b] })
//
// Controls (AZERTY):  P1  move Z Q S D · turn A / E · shoot Space
//                     P2  move 8 4 5 6 · turn 7 / 9 · shoot M

const NetSim = (() => {
    const W = 600, H = 450;           // arena, world units
    const SPEED = 190;                // units / s
    const ROT = 3.4;                  // rad / s
    const BSPEED = 430, BTTL = 1.3;   // bullets
    const COOL = 0.2;                 // fire cooldown (s)
    const R = 26;                     // player radius
    const INPUT_DT = 1 / 60;          // clients sample input at 60 Hz
    const COLORS = ['#5FE8FF', '#FF66DD'];

    // physical key positions (KeyboardEvent.code), so the layout set in the OS doesn't matter.
    // Labels are the AZERTY keys printed at those positions.
    const KEYS = [
        { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], rl: ['KeyQ'], rr: ['KeyE'], fire: ['Space'] },
        { up: ['Numpad8', 'Digit8'], down: ['Numpad5', 'Digit5'], left: ['Numpad4', 'Digit4'], right: ['Numpad6', 'Digit6'],
          rl: ['Numpad7', 'Digit7'], rr: ['Numpad9', 'Digit9'], fire: ['Semicolon'] },
    ];
    const GAME_KEYS = new Set(KEYS.flatMap(k => Object.values(k).flat()));

    // top-down Bydos (wings spread, nose → right), tinted per player
    const ship = new Image(); ship.src = 'assets/bydos_top.png';
    const TINT = ['hue-rotate(180deg) saturate(1.4)', 'hue-rotate(300deg) saturate(1.3)'];
    const SW = 52, SH = 60;           // drawn size, world units (sprite is 21×24)

    const clone = o => JSON.parse(JSON.stringify(o));

    function applyCmd(p, c) {
        p.a += c.rot * ROT * c.dt;
        let mx = c.mx, my = c.my;
        const len = Math.hypot(mx, my);
        if (len > 0) { mx /= len; my /= len; }
        p.x = Math.max(R, Math.min(W - R, p.x + mx * SPEED * c.dt));
        p.y = Math.max(R, Math.min(H - R, p.y + my * SPEED * c.dt));
    }

    function mount(root, opts) {
        const cfg = {
            tick: opts.tick ?? 20,
            c: [0, 1].map(i => ({
                lat: opts.lat?.[i] ?? 100,
                jitter: opts.jitter?.[i] ?? 0,
                loss: opts.loss?.[i] ?? 0,
                online: true,
                pred: opts.pred?.[i] ?? true,
                interp: opts.interp?.[i] ?? true,
            })),
        };

        // ---------- UI ----------
        const kc = s => s.split(' ').map(k => `<kbd>${k}</kbd>`).join('');
        const KEYHELP = [
            `${kc('Z Q S D')} move ${kc('A E')} turn ${kc('Space')} shoot`,
            `${kc('8 4 5 6')} move ${kc('7 9')} turn ${kc('M')} shoot`,
        ];
        const clientCol = i => `
            <div class="ns-col c${i}">
                <div class="ns-h"><span>client ${i + 1}</span></div>
                <div class="ns-keys">${KEYHELP[i]}</div>
                <div class="ns-view">
                    <canvas data-v="c${i}"></canvas>
                    <div class="ns-log" data-log="${i}"></div>
                </div>
                <div class="ns-fields">
                    <label><span>latency <small>one way</small></span><span><input type="number" min="0" max="2000" step="10" data-lat="${i}"> ms</span></label>
                    <label><span>jitter <small>±</small></span><span><input type="number" min="0" max="1000" step="10" data-jit="${i}"> ms</span></label>
                    <label><span>loss <small>per packet</small></span><span><input type="number" min="0" max="100" step="1" data-loss="${i}"> %</span></label>
                    <span class="ns-rtt" data-rtt="${i}"></span>
                </div>
                <div class="ns-toggles">
                    <button class="ns-tog" data-pred="${i}"><span class="tn">prediction</span><span class="ts"></span><span class="th">move my ship now</span></button>
                    <button class="ns-tog" data-interp="${i}"><span class="tn">interpolation</span><span class="ts"></span><span class="th">smooth the other ship</span></button>
                    <button class="ns-tog ns-dc on" data-dc="${i}"><span class="tn">cable</span><span class="ts"></span><span class="th"></span></button>
                </div>
                <div class="ns-stats" data-stats="${i}"></div>
            </div>`;
        root.innerHTML = `
            <div class="ns">
                <div class="ns-screens">
                    ${clientCol(0)}
                    <div class="ns-col srv">
                        <div class="ns-h"><span>server</span></div>
                        <div class="ns-keys">the truth — everyone else sees it late</div>
                        <div class="ns-view">
                            <canvas data-v="srv"></canvas>
                            <div class="ns-log" data-slog></div>
                        </div>
                        <div class="ns-row">
                            <label>tick rate <small>sim + snapshots</small></label>
                            <input type="number" min="1" max="120" step="1" data-tick><span class="unit">ticks/s</span>
                            <span class="ns-rtt" data-tickms></span>
                        </div>
                        <div class="ns-stats" data-sstats></div>
                        <div class="ns-stats" data-score></div>
                    </div>
                    ${clientCol(1)}
                </div>
                <div class="ns-legend">
                    <span><b>latency</b> one-way trip, client → server</span>
                    <span><b>RTT</b> round trip = 2 × latency</span>
                    <span><b>tick rate</b> server sims + snapshots per second</span>
                    <span><b>prediction</b> move my ship now, fix it later</span>
                    <span><b>unacked</b> inputs sent, not yet confirmed</span>
                    <span><b>snaps</b> snapshots received per second</span>
                    <span><b>age</b> how old the last snapshot is</span>
                    <span><b>interpolation</b> draw others between 2 snapshots</span>
                    <span><b>in flight</b> inputs still travelling to the server</span>
                    <span><b>jitter</b> each packet ± random delay → reordering</span>
                    <span><b>loss</b> % of packets that vanish, both ways</span>
                    <span><b>cable</b> cut it: predict alone, snap back on reconnect</span>
                    <span><b>lost ↑↓</b> inputs / snapshots that never arrived</span>
                    <span><b class="dash">▭</b> where the server last confirmed you</span>
                    <span><b>sending ↑</b> <em class="fly">white</em> in flight · <em class="ack">grey</em> confirmed</span>
                    <span><b>applied ↓</b> inputs as the server gets them — late</span>
                </div>
                <div class="ns-focus"><span>click to play</span></div>
            </div>`;

        const $ = s => root.querySelector(s);
        const clampNum = (v, lo, hi, fallback) => {
            if (v === '' || v === null) return fallback;
            const n = Math.round(Number(v));
            return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
        };
        const canvases = { c0: $('[data-v=c0]'), c1: $('[data-v=c1]'), srv: $('[data-v=srv]') };
        const focus = $('.ns-focus');

        function syncUI() {
            for (const i of [0, 1]) {
                for (const [key, v] of [['lat', cfg.c[i].lat], ['jit', cfg.c[i].jitter], ['loss', cfg.c[i].loss]]) {
                    const inp = $(`[data-${key}="${i}"]`);
                    if (document.activeElement !== inp) inp.value = v;
                }
                const dc = $(`[data-dc="${i}"]`);
                dc.classList.toggle('on', cfg.c[i].online);
                dc.querySelector('.ts').textContent = cfg.c[i].online ? 'ON' : 'CUT';
                dc.querySelector('.th').textContent = cfg.c[i].online ? 'click to disconnect' : 'click to reconnect';
                $(`[data-rtt="${i}"]`).textContent = `RTT ${cfg.c[i].lat * 2} ms`;
                for (const [key, on] of [['pred', cfg.c[i].pred], ['interp', cfg.c[i].interp]]) {
                    const b = $(`[data-${key}="${i}"]`);
                    b.classList.toggle('on', on);
                    b.querySelector('.ts').textContent = on ? 'ON' : 'OFF';
                }
            }
            if (document.activeElement !== $('[data-tick]')) $('[data-tick]').value = cfg.tick;
            $('[data-tickms]').textContent = `every ${Math.round(1000 / cfg.tick)} ms`;
        }
        for (const i of [0, 1]) {
            for (const [key, field, hi] of [['lat', 'lat', 2000], ['jit', 'jitter', 1000], ['loss', 'loss', 100]]) {
                const inp = $(`[data-${key}="${i}"]`);
                const apply = () => { cfg.c[i][field] = clampNum(inp.value, 0, hi, cfg.c[i][field]); syncUI(); };
                inp.addEventListener('input', apply);
                inp.addEventListener('change', apply);
            }
            $(`[data-dc="${i}"]`).addEventListener('click', () => { cfg.c[i].online = !cfg.c[i].online; syncUI(); });
            $(`[data-pred="${i}"]`).addEventListener('click', () => { cfg.c[i].pred = !cfg.c[i].pred; clients[i].pending = []; syncUI(); });
            $(`[data-interp="${i}"]`).addEventListener('click', () => { cfg.c[i].interp = !cfg.c[i].interp; syncUI(); });
        }
        const tick = $('[data-tick]');
        tick.addEventListener('input', () => { cfg.tick = clampNum(tick.value, 1, 120, cfg.tick); syncUI(); });
        tick.addEventListener('change', () => { cfg.tick = clampNum(tick.value, 1, 120, cfg.tick); syncUI(); });
        // Enter applies the value and hands the keyboard back to the game
        root.querySelectorAll('input[type=number]').forEach(inp =>
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); }));
        syncUI();

        // ---------- input ----------
        const down = new Set();
        const norm = e => e.code;
        const typing = e => e.target && e.target.tagName === 'INPUT';
        window.addEventListener('keydown', e => {
            if (typing(e)) return;               // typing a value, not playing
            const k = norm(e);
            if (GAME_KEYS.has(k)) { down.add(k); e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);
        window.addEventListener('keyup', e => {
            if (typing(e)) return;
            const k = norm(e);
            if (GAME_KEYS.has(k)) { down.delete(k); e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);
        window.addEventListener('blur', () => down.clear());
        Object.values(canvases).forEach(c => c.addEventListener('mousedown', () => window.focus()));
        focus.addEventListener('click', () => { window.focus(); focus.classList.add('hide'); });

        function readCmd(i) {
            const k = KEYS[i];
            const on = action => k[action].some(code => down.has(code)) ? 1 : 0;
            return {
                dt: INPUT_DT,
                mx: on('right') - on('left'),
                my: on('down') - on('up'),
                rot: on('rr') - on('rl'),
                fire: !!on('fire'),
            };
        }

        // ---------- simulation ----------
        let t = 0;
        const server = {
            players: [
                { x: 150, y: 225, a: 0, cool: 0, score: 0, hit: 0 },
                { x: 450, y: 225, a: Math.PI, cool: 0, score: 0, hit: 0 },
            ],
            bullets: [], nextId: 1, acc: 0, tickNo: 0, lastSeq: [0, 0], pulse: 0, log: [],
        };
        const toServer = [];
        const toClient = [[], []];

        // one packet's trip for client i: latency ± jitter, or lost (loss %, cable cut)
        const tripTime = i => {
            const c = cfg.c[i];
            const j = c.jitter ? (Math.random() * 2 - 1) * c.jitter : 0;
            return Math.max(0, c.lat + j) / 1000;
        };
        const lost = i => !cfg.c[i].online || Math.random() * 100 < cfg.c[i].loss;
        const clients = [0, 1].map(i => ({
            seq: 0, pending: [], snaps: [],
            own: clone(server.players[i]), conf: clone(server.players[i]),
            acc: 0, recv: [], log: [], ack: 0, lastTick: 0, lostUp: 0, lostDown: 0,
        }));

        function serverTick(dt) {
            // 1. inputs that have arrived, in arrival order
            toServer.sort((a, b) => a.at - b.at);
            while (toServer.length && toServer[0].at <= t) {
                const { c, cmd } = toServer.shift();
                if (cmd.seq <= server.lastSeq[c]) continue;     // late, out of order: too old, drop it
                const p = server.players[c];
                applyCmd(p, cmd);
                p.cool -= cmd.dt;
                if (cmd.fire && p.cool <= 0) {
                    p.cool = COOL;
                    server.bullets.push({
                        id: server.nextId++, owner: c, ttl: BTTL,
                        x: p.x + Math.cos(p.a) * R, y: p.y + Math.sin(p.a) * R,
                        vx: Math.cos(p.a) * BSPEED, vy: Math.sin(p.a) * BSPEED,
                    });
                }
                server.lastSeq[c] = cmd.seq;
                // log what just arrived, grouped like the clients' logs
                const desc = describe(cmd);
                const top = server.log.find(l => l.c === c);      // this client's latest line
                if (top && top.desc === desc) top.to = cmd.seq;
                else { server.log.unshift({ c, from: cmd.seq, to: cmd.seq, desc }); server.log.length = Math.min(server.log.length, 9); }
            }
            // 2. simulate bullets
            for (const b of server.bullets) {
                b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
                const target = server.players[1 - b.owner];
                if (Math.hypot(b.x - target.x, b.y - target.y) < R) {
                    b.ttl = 0; target.hit = 0.3; server.players[b.owner].score++;
                }
            }
            server.bullets = server.bullets.filter(b => b.ttl > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
            server.players.forEach(p => { p.hit = Math.max(0, p.hit - dt); });
            // 3. one snapshot per client, delivered after its latency
            server.tickNo++;
            server.pulse = 1;
            const snap = {
                ts: t,
                tick: server.tickNo,
                players: clone(server.players),
                bullets: server.bullets.map(b => ({ id: b.id, owner: b.owner, x: b.x, y: b.y })),
            };
            for (const c of [0, 1]) {
                if (lost(c)) { clients[c].lostDown++; continue; }
                toClient[c].push({ at: t + tripTime(c), snap: { ...snap, ack: server.lastSeq[c] } });
            }
        }

        // human-readable input, e.g. "↑ → ⟳ FIRE"
        function describe(c) {
            const parts = [];
            if (c.my < 0) parts.push('up');
            if (c.my > 0) parts.push('down');
            if (c.mx < 0) parts.push('left');
            if (c.mx > 0) parts.push('right');
            if (c.rot < 0) parts.push('turn-L');
            if (c.rot > 0) parts.push('turn-R');
            if (c.fire) parts.push('FIRE');
            return parts.length ? parts.join(' ') : 'idle';
        }

        function clientStep(i) {
            const cl = clients[i], me = cfg.c[i];
            const cmd = readCmd(i);
            cmd.seq = ++cl.seq;
            // log: consecutive identical inputs are grouped into one line
            const desc = describe(cmd);
            if (cl.log.length && cl.log[0].desc === desc) cl.log[0].to = cmd.seq;
            else { cl.log.unshift({ from: cmd.seq, to: cmd.seq, desc }); cl.log.length = Math.min(cl.log.length, 9); }
            if (lost(i)) cl.lostUp++;
            else toServer.push({ at: t + tripTime(i), c: i, cmd });
            if (me.pred) {
                applyCmd(cl.own, cmd);
                cl.pending.push(cmd);
            }
        }

        function clientReceive(i) {
            const cl = clients[i], me = cfg.c[i];
            const q = toClient[i];
            q.sort((a, b) => a.at - b.at);               // jitter can reorder packets
            while (q.length && q[0].at <= t) {
                const { snap } = q.shift();
                if (snap.tick <= cl.lastTick) continue;    // older than what we have: ignore
                cl.lastTick = snap.tick;
                cl.snaps.push(snap);
                if (cl.snaps.length > 40) cl.snaps.shift();
                cl.recv.push(t);
                cl.conf = clone(snap.players[i]);
                cl.ack = snap.ack;
                if (me.pred) {
                    // reconciliation: restart from the server's answer, replay what it hasn't seen yet
                    cl.own = clone(cl.conf);
                    cl.pending = cl.pending.filter(c => c.seq > snap.ack);
                    for (const c of cl.pending) applyCmd(cl.own, c);
                } else {
                    cl.own = clone(cl.conf);
                }
            }
            cl.recv = cl.recv.filter(r => r > t - 1);
        }

        // the other player + bullets, as client i draws them
        function othersView(i) {
            const cl = clients[i], me = cfg.c[i];
            const snaps = cl.snaps;
            if (!snaps.length) return null;
            const latest = snaps[snaps.length - 1];
            if (!me.interp || snaps.length < 2) return { other: latest.players[1 - i], bullets: latest.bullets };
            const delay = 1.5 / cfg.tick;
            const rt = t - me.lat / 1000 - delay;
            let a = null, b = null;
            for (let k = snaps.length - 1; k > 0; k--) {
                if (snaps[k - 1].ts <= rt && snaps[k].ts >= rt) { a = snaps[k - 1]; b = snaps[k]; break; }
            }
            if (!a) return { other: (rt < snaps[0].ts ? snaps[0] : latest).players[1 - i], bullets: latest.bullets };
            const f = (rt - a.ts) / Math.max(1e-6, b.ts - a.ts);
            const lerp = (u, v) => u + (v - u) * f;
            const pa = a.players[1 - i], pb = b.players[1 - i];
            const other = { ...pb, x: lerp(pa.x, pb.x), y: lerp(pa.y, pb.y), a: lerp(pa.a, pb.a) };
            const bullets = b.bullets.map(bb => {
                const ba = a.bullets.find(x => x.id === bb.id);
                return ba ? { ...bb, x: lerp(ba.x, bb.x), y: lerp(ba.y, bb.y) } : bb;
            });
            return { other, bullets };
        }

        // ---------- drawing ----------
        function fit(c) {
            const r = c.getBoundingClientRect();
            if (!r.width) return;
            c.width = r.width * devicePixelRatio;
            c.height = r.height * devicePixelRatio;
        }
        function frameOf(c) {
            const g = c.getContext('2d');
            const s = c.width / W;
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, c.width, c.height);
            g.setTransform(s, 0, 0, s, 0, 0);
            g.imageSmoothingEnabled = false;
            g.strokeStyle = '#1c1c34'; g.lineWidth = 1;
            for (let x = 0; x <= W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
            for (let y = 0; y <= H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
            return g;
        }
        function drawShip(g, p, who, alpha = 1) {
            g.save();
            g.globalAlpha = alpha;
            g.translate(p.x, p.y);
            g.rotate(p.a);
            if (ship.complete) {
                g.filter = TINT[who];
                g.drawImage(ship, -SW / 2, -SH / 2, SW, SH);
                g.filter = 'none';
            }
            g.strokeStyle = COLORS[who]; g.lineWidth = 2;
            g.beginPath(); g.moveTo(SW / 2 + 4, 0); g.lineTo(SW / 2 + 20, 0); g.stroke();
            g.restore();
            if (p.hit > 0) {
                g.strokeStyle = '#FF4400'; g.lineWidth = 3;
                g.beginPath(); g.arc(p.x, p.y, R + 8, 0, Math.PI * 2); g.stroke();
            }
        }
        function drawGhost(g, p, who) {
            g.save();
            g.translate(p.x, p.y);
            g.rotate(p.a);
            g.setLineDash([6, 5]); g.strokeStyle = COLORS[who]; g.lineWidth = 2;
            g.strokeRect(-SW / 2, -SH / 2, SW, SH);
            g.restore();
        }
        function drawBullets(g, bullets) {
            for (const b of bullets) {
                g.fillStyle = COLORS[b.owner];
                g.beginPath(); g.arc(b.x, b.y, 6, 0, Math.PI * 2); g.fill();
            }
        }
        function label(g, text, color = '#9a9aae') {
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.font = `${12 * devicePixelRatio}px "JetBrains Mono", monospace`;
            g.fillStyle = color;
            g.fillText(text, 8 * devicePixelRatio, 18 * devicePixelRatio);
        }

        function drawClient(i) {
            const c = canvases['c' + i];
            const g = frameOf(c);
            const cl = clients[i], me = cfg.c[i];
            const view = othersView(i);
            if (view) {
                drawBullets(g, view.bullets);
                drawShip(g, view.other, 1 - i);
            }
            if (me.pred) drawGhost(g, cl.conf, i);
            drawShip(g, me.pred ? cl.own : cl.conf, i);
            if (!me.online) label(g, 'DISCONNECTED — on my own', '#FF7755');
            else label(g, me.pred ? 'dashed = server-confirmed' : 'server view only');
            const age = cl.snaps.length ? Math.round((t - cl.snaps[cl.snaps.length - 1].ts) * 1000) : 0;
            root.querySelector(`[data-log="${i}"]`).innerHTML =
                '<div class="lh">sending ↑</div>' +
                cl.log.map(l => {
                    const state = l.to <= cl.ack ? 'acked' : (l.from <= cl.ack ? 'part' : 'fly');
                    const secs = ((l.to - l.from + 1) * INPUT_DT).toFixed(1);
                    return `<div class="${state}${l.desc === 'idle' ? ' idle' : ''}"><i>#${l.to}</i> ${l.desc} <u>${secs} s</u></div>`;
                }).join('');
            root.querySelector(`[data-stats="${i}"]`).innerHTML =
                `lost ↑<b>${cl.lostUp}</b> ↓<b>${cl.lostDown}</b> · unacked <b>${me.pred ? cl.pending.length : '—'}</b> · snaps <b>${cl.recv.length}</b>/s · age <b>${age}</b> ms`;
        }

        function drawServer() {
            const c = canvases.srv;
            const g = frameOf(c);
            drawBullets(g, server.bullets);
            server.players.forEach((p, i) => {
                drawShip(g, p, i, cfg.c[i].online ? 1 : 0.35);
                if (!cfg.c[i].online) {
                    g.fillStyle = '#FF7755';
                    g.font = 'bold 16px "JetBrains Mono", monospace';
                    g.textAlign = 'center';
                    g.fillText('OFFLINE', p.x, p.y - 42);
                    g.textAlign = 'start';
                }
            });
            if (server.pulse > 0) {
                g.strokeStyle = `rgba(255, 176, 0, ${server.pulse})`; g.lineWidth = 6;
                g.strokeRect(3, 3, W - 6, H - 6);
            }
            label(g, `tick #${server.tickNo}`, '#FFB000');
            root.querySelector('[data-slog]').innerHTML =
                '<div class="lh">applied ↓</div>' +
                server.log.map(l => {
                    const secs = ((l.to - l.from + 1) * INPUT_DT).toFixed(1);
                    return `<div class="p${l.c}${l.desc === 'idle' ? ' idle' : ''}">P${l.c + 1} <i>#${l.to}</i> ${l.desc} <u>${secs} s</u></div>`;
                }).join('');
            root.querySelector('[data-sstats]').innerHTML =
                `inputs in flight <b>${toServer.length}</b> · bullets <b>${server.bullets.length}</b>`;
            root.querySelector('[data-score]').innerHTML =
                `score <b style="color:${COLORS[0]}">P1 ${server.players[0].score}</b> – <b style="color:${COLORS[1]}">${server.players[1].score} P2</b>`;
        }

        // ---------- main loop ----------
        let last = performance.now();
        function frame(now) {
            let dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            focus.classList.toggle('hide', document.hasFocus());
            if (typeof paused !== 'undefined' && paused) dt = 0;

            // advance in small fixed steps so input sampling, ticks and deliveries interleave correctly
            let remaining = dt;
            while (remaining > 1e-9) {
                const step = Math.min(remaining, INPUT_DT);
                t += step;
                remaining -= step;
                for (const i of [0, 1]) {
                    clients[i].acc += step;
                    while (clients[i].acc >= INPUT_DT) { clients[i].acc -= INPUT_DT; clientStep(i); }
                }
                server.acc += step;
                const tickDt = 1 / cfg.tick;
                while (server.acc >= tickDt) { server.acc -= tickDt; serverTick(tickDt); }
                clientReceive(0);
                clientReceive(1);
            }
            server.pulse = Math.max(0, server.pulse - dt * 6);

            drawClient(0);
            drawServer();
            drawClient(1);
            requestAnimationFrame(frame);
        }

        const refit = () => Object.values(canvases).forEach(fit);
        window.addEventListener('resize', refit);
        refit();
        requestAnimationFrame(frame);
    }

    return { mount };
})();
