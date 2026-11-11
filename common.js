// 共通部品。★バージョンはここだけ書き換えればOK(Claudeが更新のたびに変更します)
const APP_VERSION='3.1.0',APP_DATE='2026-11-10';
const $=s=>document.querySelector(s),$v=s=>$(s).value;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>new Date(t).toLocaleString('ja-JP');
const G={'教材について(追加)':'#2563eb','教材について(更新)':'#2563eb','お知らせ':'#f59e0b','重要なお知らせ':'#dc2626','メッセージ':'#16a34a'};
const verHtml=()=>`<p class="ver">Bribly(ぶりぶりー)<br>バージョン v${APP_VERSION}(${APP_DATE})</p>`;

// 管理者が編集した規約があれば、それを使う(なければ legal.js の文章)
async function loadLegal(){try{const s=await db.doc('settings/legal').get();if(s.exists){if(s.data().terms)TERMS=s.data().terms;if(s.data().priv)PRIV=s.data().priv}}catch(x){}}
/* ロゴ: 開いた本のマーク + 「Bribly」 */
const logoSvg=(s=32,bg='#1d4ed8',fg='#fff')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 40 40" style="vertical-align:middle;flex:none"><rect width="40" height="40" rx="10" fill="${bg}"/><path d="M8 12c4-2 8-2 12 1v16c-4-3-8-3-12-1zM32 12c-4-2-8-2-12 1v16c4-3 8-3 12-1z" fill="${fg}"/></svg>`;
const brandHtml=(bg,fg,small)=>`<div class="brand${small?' sm':''}">${logoSvg(small?30:44,bg,fg)}<span>Bribly</span></div>`;
function setFavicon(bg){try{let l=document.querySelector('link[rel=icon]');if(!l){l=document.createElement('link');l.rel='icon';document.head.append(l)}l.href='data:image/svg+xml;base64,'+btoa(logoSvg(64,bg))}catch(x){}}
setFavicon('#1d4ed8');
function showLegal(t,x){
  const d=document.createElement('dialog');
  d.innerHTML=`<h3>${t}</h3><div style="white-space:pre-wrap;font-size:14px;line-height:1.7;max-height:60vh;overflow:auto">${e(x)}</div><p><button class="b" onclick="this.closest('dialog').remove()">閉じる</button></p>`;
  document.body.append(d);d.showModal();
}

/* ---- 外部部品(PDF表示用 pdf.js / PDF作成用 pdf-lib)。1つ目がだめなら次の場所を試す ---- */
const LIBS={
  pdfjs:['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'],
  pdflib:['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js','https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js','https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js']};
const ldScript=src=>new Promise((ok,ng)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{s.remove();ng()};document.head.append(s)});
let PC='',PDFDOC=null;
async function loadLib(k){
  const g={pdfjs:'pdfjsLib',pdflib:'PDFLib'}[k];if(window[g])return;
  for(const u of LIBS[k]){
    try{await ldScript(u)}catch(x){continue}
    if(k=='pdfjs'){
      const b=u.slice(0,u.lastIndexOf('/')+1);
      try{const t=await(await fetch(b+'pdf.worker.min.js')).text();pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([t],{type:'text/javascript'}))}
      catch(x){pdfjsLib.GlobalWorkerOptions.workerSrc=b+'pdf.worker.min.js'}
      PC=b+(u.includes('cdnjs')?'cmaps/':'../cmaps/');
    }
    return;
  }
  throw new Error('必要な部品を読み込めません。ネットワークや拡張機能のブロックを確認してください');
}
// PDFデータは、大きいものを約0.9MBずつに分けて保存してある(blobs/ID, blobs/ID_1, blobs/ID_2 ...)
async function getBlob64(id){
  const s=await db.doc('blobs/'+id).get();
  if(!s.exists)throw new Error('PDFデータが見つかりません。管理者サイトで再アップロードしてください');
  const n=s.data().n||1,parts=[s.data().d];
  if(n>1){
    const r=await Promise.all(Array.from({length:n-1},(_,k)=>db.doc('blobs/'+id+'_'+(k+1)).get()));
    r.forEach(x=>{if(!x.exists)throw new Error('PDFデータが一部見つかりません。管理者サイトで再アップロードしてください');parts.push(x.data().d)});
  }
  return parts.join('');
}
const b64ToU8=b=>{const s=atob(b),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
// PDFを読み込む(画面には出さない)。ビューア「ひらく」用
async function getPdf(id){
  await loadLib('pdfjs');
  PDFDOC=await pdfjsLib.getDocument({data:b64ToU8(await getBlob64(id)),cMapUrl:PC,cMapPacked:true}).promise;
  return PDFDOC;
}
async function renderPdf(id,box,wm){
  await getPdf(id);
  box.innerHTML='';
  for(let i=1;i<=PDFDOC.numPages;i++){
    const pg=await PDFDOC.getPage(i),vp=pg.getViewport({scale:1.6}),c=document.createElement('canvas');
    c.width=vp.width;c.height=vp.height;
    await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
    if(wm){const x=c.getContext('2d');x.font=Math.round(vp.width/55)+'px sans-serif';x.fillStyle='rgba(0,0,0,.5)';x.textAlign='center';x.fillText(wm,vp.width/2,vp.height*0.985)}
    const w=document.createElement('div');w.className='pg';w.append(c);box.append(w);
  }
}
