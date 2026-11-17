// Bribly の通知を受け取るファイル(サービスワーカー)
self.addEventListener('push',e=>{
  let d={};try{d=e.data.json()}catch(x){}
  e.waitUntil(self.registration.showNotification(d.title||'Bribly',{
    body:d.body||'',icon:'apple-touch-icon.png',tag:d.tag||undefined,data:{url:d.url||'./'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){if('focus' in c)return c.focus()}
    return clients.openWindow((e.notification.data&&e.notification.data.url)||'./');
  }));
});
