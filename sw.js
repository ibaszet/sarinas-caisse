// Service Worker — Sarinas Beauty Center Caisse
// Rôle : mettre en cache la coquille de l'app (HTML/manifeste/icônes/SDK Firebase)
// pour que l'écran de caisse s'ouvre INSTANTANÉMENT même sans connexion.
// Les données elles-mêmes (RDV/paiements/stock) restent gérées par Firebase +
// la file d'attente hors-ligne définie dans index.html — ce fichier ne s'occupe
// que des fichiers statiques nécessaires à l'affichage de l'app.

const CACHE_VERSION = 'sarinas-caisse-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // addAll échoue en bloc si UNE seule requête échoue ; on met donc chaque
      // fichier en cache individuellement pour que les polices/SDK externes qui
      // échoueraient (réseau lent, CORS...) ne bloquent pas tout l'app shell.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('SW: échec mise en cache', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // ne jamais intercepter les écritures Firebase

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // Met à jour le cache en arrière-plan à chaque succès réseau
          // (stale-while-revalidate) pour que la prochaine ouverture hors-ligne
          // reflète la dernière version vue.
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached); // hors-ligne : on retombe sur le cache

      return cached || network;
    })
  );
});
