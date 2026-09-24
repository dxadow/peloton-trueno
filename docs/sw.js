// Pelotón Trueno — service worker: permite jugar sin conexión (el co-op online sí necesita internet)
const CACHE='pt-v1790283479';
const FILES=['./','index.html','net-firebase.js','firebase-config.js','manifest.webmanifest','icon-192.png','icon-512.png',
  'vendor/firebase-app-compat.js','vendor/firebase-auth-compat.js','vendor/firebase-database-compat.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return; // Firebase y fuentes van directo a internet
  const page=e.request.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('/');
  if(page){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));return}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return n})));
});
