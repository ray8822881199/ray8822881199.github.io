const CACHE_NAME = 'v1_cache';

// 安裝 Service Worker
self.addEventListener('install', (event) => {
    // 在安裝時不緩存任何資源
    self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
    // 在激活時強制控制所有客戶端
    event.waitUntil(self.clients.claim());
});

// 檢查資源並從網絡加載（不使用緩存）
self.addEventListener('fetch', (event) => {
    // 直接從網絡加載所有請求，無論是靜態還是動態資源
    event.respondWith(fetch(event.request));
});