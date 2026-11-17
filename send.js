// 管理者が「通知も送る」にしたお知らせを、利用者のスマホに送る(GitHub Actionsで動きます)
const admin=require('firebase-admin');
const webpush=require('web-push');
if(!process.env.FIREBASE_SERVICE_ACCOUNT){console.log('FIREBASE_SERVICE_ACCOUNT が未設定です');process.exit(0)}
admin.initializeApp({credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
const db=admin.firestore();
const cut=(s,n)=>{const a=[...String(s||'').replace(/\s+/g,' ').trim()];return a.length>n?a.slice(0,n).join('')+'…':a.join('')};
(async()=>{
  const pending=await db.collection('notices').where('pushed','==',false).get();
  const todo=pending.docs.filter(d=>d.data().push===true);
  if(!todo.length){console.log('送るお知らせはありません');return}
  const cfg=(await db.doc('settings/push').get()).data()||{};
  if(!cfg.vapid||!process.env.VAPID_PRIVATE_KEY){console.log('通知の鍵が未設定です');return}
  webpush.setVapidDetails(process.env.SITE_URL||'https://example.com',cfg.vapid,process.env.VAPID_PRIVATE_KEY);
  const [subsSnap,usersSnap]=await Promise.all([db.collection('pushsubs').get(),db.collection('users').get()]);
  const users={};usersSnap.forEach(u=>users[u.id]=u.data());
  for(const nd of todo){
    const n=nd.data();let sent=0,fail=0;
    const title=(n.genre==='重要なお知らせ'?'【重要】':'')+n.subject;
    for(const s of subsSnap.docs){
      const pid=s.id,u=users[pid];if(!u||u.banned)continue;
      const to=n.to||[];
      const forMe=to.includes('all')||to.includes(pid)||(n.future&&(u.createdAt||0)>n.createdAt);
      if(!forMe)continue;
      const np=s.data().np||{};
      if(n.genre!=='重要なお知らせ'&&np[n.genre]===false)continue; // ジャンルごとの通知設定(重要なお知らせは常に送る)
      for(const [k,sub] of Object.entries(s.data().subs||{})){
        try{
          await webpush.sendNotification(sub,JSON.stringify({title,body:cut(n.body,100),tag:nd.id,url:'./'}),{TTL:86400});
          sent++;
        }catch(e){
          fail++;
          if(e.statusCode===404||e.statusCode===410)await s.ref.update({['subs.'+k]:admin.firestore.FieldValue.delete()}); // 使えなくなった登録を消す
        }
      }
    }
    await nd.ref.update({pushed:true,pushedAt:Date.now(),pushSent:sent,pushFail:fail});
    console.log(`「${n.subject}」: 送信 ${sent} 件 / 失敗 ${fail} 件`);
  }
})().catch(e=>{console.error(e);process.exit(1)});
