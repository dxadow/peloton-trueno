/*
 * Pelotón Trueno — conexión multijugador con Firebase Realtime Database.
 *
 * Imita la interfaz de "sala" que usa el juego (presence / emit / on / onPeers / peers),
 * así el código del juego es el mismo dentro de Claude y en la app de Android.
 *
 * Estructura en la base de datos:
 *   /lobby/peers/{uid}         -> { p: {presencia del jugador}, t: marca de tiempo }
 *   /lobby/ev/{tema}/{uid}     -> { d: datos, ts: marca de tiempo }   (último mensaje de cada jugador)
 * Cada jugador entra con Auth anónima; las reglas solo le permiten escribir su propio {uid}.
 */
(function () {
  'use strict';
  const TOPICS = ['snap', 'start'];
  const STALE_MS = 90000;      // un jugador sin latido en 90 s se considera desconectado
  const HEARTBEAT_MS = 30000;

  window.createFirebaseRoom = async function (cfg) {
    if (!window.firebase || !cfg || !cfg.apiKey || String(cfg.apiKey).includes('PEGA_AQUI')) return null;
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    const auth = app.auth(), db = app.database();
    if (cfg.emulator) {
      auth.useEmulator(cfg.emulator.auth);
      db.useEmulator(cfg.emulator.dbHost, cfg.emulator.dbPort);
    }
    // Cada pestaña/apertura del juego es un jugador distinto (si no, dos pestañas del mismo
    // navegador compartirían el mismo usuario anónimo y no se verían entre sí).
    try { await auth.setPersistence(firebase.auth.Auth.Persistence.NONE); } catch (e) { }
    const cred = await auth.signInAnonymously();
    const uid = cred.user.uid;

    let offset = 0;
    db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
    const now = () => Date.now() + offset;
    const joinTs = Date.now();

    const base = db.ref('lobby');
    const myRef = base.child('peers/' + uid);
    const TS = firebase.database.ServerValue.TIMESTAMP;
    let mine = {}, connected = false;

    const raw = new Map();            // uid -> {p, t}
    const frozen = new Map();         // uid -> Peer congelado (se reutiliza si no cambió)
    let snapshot = Object.freeze([]);
    const peerHandlers = [], connHandlers = [];

    function makePeer(id, v) {
      return Object.freeze({
        peer: id, by: null, isMe: id === uid, sameTab: id === uid, kind: 'viewer', guest: false,
        presence: Object.freeze(Object.assign({}, (v && v.p) || {})), updatedAt: Date.now()
      });
    }
    function alive(id, v) { return id === uid || !v || !v.t || now() - v.t < STALE_MS; }
    function rebuild(changed) {
      const prev = snapshot;
      const list = [];
      if (!raw.has(uid)) raw.set(uid, { p: mine });
      for (const [id, v] of raw) {
        if (!alive(id, v)) continue;
        let p = frozen.get(id);
        if (!p || id === changed) { p = makePeer(id, v); frozen.set(id, p); }
        list.push(p);
      }
      snapshot = Object.freeze(list);
      const prevIds = new Set(prev.map(p => p.peer)), nowIds = new Set(list.map(p => p.peer));
      const change = {
        peers: snapshot,
        joined: Object.freeze(list.filter(p => !prevIds.has(p.peer))),
        left: Object.freeze(prev.filter(p => !nowIds.has(p.peer))),
        updated: Object.freeze(list.filter(p => prevIds.has(p.peer) && p.peer === changed))
      };
      for (const f of peerHandlers) { try { f(change); } catch (e) { console.error(e); } }
    }

    const writeMine = () => myRef.set({ p: mine, t: TS }).catch(e => console.warn('presencia', e));
    db.ref('.info/connected').on('value', s => {
      connected = !!s.val();
      if (connected) { myRef.onDisconnect().remove(); writeMine(); }
      for (const f of connHandlers) { try { f(connected); } catch (e) { } }
    });
    setInterval(() => { if (connected) writeMine(); rebuild(null); }, HEARTBEAT_MS);
    // Al volver de segundo plano (p. ej. tras mandar el código por WhatsApp) se re-anuncia la partida al instante
    const wake = () => { if (connected) writeMine(); rebuild(null); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    window.addEventListener('focus', wake); window.addEventListener('online', wake);
    document.addEventListener('resume', wake);

    const peersRef = base.child('peers');
    peersRef.on('child_added', s => { raw.set(s.key, s.val() || {}); rebuild(s.key); });
    peersRef.on('child_changed', s => { raw.set(s.key, s.val() || {}); rebuild(s.key); });
    peersRef.on('child_removed', s => { raw.delete(s.key); frozen.delete(s.key); rebuild(null); });

    const armed = new Set();
    const room = {
      snapMs: 100,   // 10 envíos por segundo: cuida la cuota gratis de Firebase
      presence(patch) {
        if (!patch || typeof patch !== 'object') return Promise.reject({ code: 'invalid_argument', message: 'patch' });
        for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
        raw.set(uid, { p: Object.assign({}, mine), t: now() }); rebuild(uid);
        return writeMine();
      },
      emit(topic, data) {
        if (!TOPICS.includes(topic)) return Promise.reject({ code: 'invalid_argument', message: 'tema' });
        const ref = base.child('ev/' + topic + '/' + uid);
        if (!armed.has(topic)) { armed.add(topic); ref.onDisconnect().remove(); }
        if (!connected) return Promise.resolve();
        return ref.set({ d: data === undefined ? null : data, ts: TS }).catch(e => { throw { code: 'upstream_error', message: String(e && e.message || e) }; });
      },
      on(topic, handler, onError) {
        if (typeof handler !== 'function') throw new TypeError('handler');
        const ref = base.child('ev/' + topic);
        const fn = s => {
          const v = s.val();
          if (!v || (typeof v.ts === 'number' && v.ts < joinTs + offset - 3000)) return; // ignora mensajes viejos
          try { handler({ topic, data: v.d, peer: s.key, by: null, isMe: s.key === uid, sameTab: s.key === uid, kind: 'viewer', guest: false }); } catch (e) { console.error(e); }
        };
        const err = e => { if (onError) onError({ code: 'upstream_error', message: String(e && e.message || e) }); };
        ref.on('child_added', fn, err); ref.on('child_changed', fn, err);
        return () => { ref.off('child_added', fn); ref.off('child_changed', fn); };
      },
      // Escucha un tema solo de UN jugador (el invitado escucha solo a su anfitrión: ahorra datos).
      onFrom(topic, peerId, handler) {
        const ref = base.child('ev/' + topic + '/' + peerId);
        const fn = s => {
          const v = s.val();
          if (!v) return;
          try { handler({ topic, data: v.d, peer: peerId, by: null, isMe: peerId === uid, sameTab: peerId === uid, kind: 'viewer', guest: false }); } catch (e) { console.error(e); }
        };
        ref.on('value', fn);
        return () => ref.off('value', fn);
      },
      peers() { return snapshot; },
      onPeers(handler) {
        peerHandlers.push(handler);
        Promise.resolve().then(() => handler({ peers: snapshot, joined: snapshot, left: Object.freeze([]), updated: Object.freeze([]) }));
        return () => { const i = peerHandlers.indexOf(handler); if (i >= 0) peerHandlers.splice(i, 1); };
      },
      connected() { return connected; },
      onConnection(handler) { connHandlers.push(handler); Promise.resolve().then(() => handler(connected)); return () => { }; }
    };
    rebuild(uid);
    return room;
  };
})();
