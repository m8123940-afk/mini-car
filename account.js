(() => {
  const $ = id => document.getElementById(id);
  const status = (s, bad=false) => { $('accountStatus').textContent=s; $('accountStatus').style.color=bad?'#ff8989':'#b5f3b8'; };
  const savedName = (()=>{try{return JSON.parse(localStorage.getItem('tr_save')||'{}').name||''}catch(e){return ''}})();
  if(savedName && savedName !== 'Гонщик') $('accountName').value=savedName;
  try { const old=JSON.parse(localStorage.getItem('tr_save')||'{}'); $('accountServer').value=String((old.set||{}).server||'').replace(/^wss:/i,'https:').replace(/^ws:/i,'http:'); } catch(e) {}
  async function auth(mode){
    const name=$('accountName').value.trim(), password=$('accountPass').value;
    if(!name || !password){status('Введите имя и пароль',true);return;}
    let save={}; try{save=JSON.parse(localStorage.getItem('tr_save')||'{}')}catch(e){}
    let base=String($('accountServer').value || (save.set||{}).server || '').trim().replace(/^wss:/i,'https:').replace(/^ws:/i,'http:').replace(/\/$/,'');
    if(!base){status('Сначала укажите адрес сервера в файле net.js (SERVER_URL)',true);return;}
    $('loginAccount').disabled=$('registerAccount').disabled=true; status('Подключаемся…');
    try{const r=await fetch(base+'/api/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,password})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка сервера');
      save.name=d.name; save.set=Object.assign({},save.set||{}, {server:base.replace(/^https:/i,'wss:').replace(/^http:/i,'ws:')}); localStorage.setItem('tr_save',JSON.stringify(save)); localStorage.setItem('tr_account_name',d.name); $('account').hidden=true; $('menu').hidden=false; window.dispatchEvent(new CustomEvent('tr-account-login',{detail:{name:d.name}})); status('Готово');
    }catch(e){status(e.message+' · проверьте адрес сервера и Render',true)}finally{$('loginAccount').disabled=$('registerAccount').disabled=false;}
  }
  $('loginAccount').addEventListener('click',()=>auth('login')); $('registerAccount').addEventListener('click',()=>auth('register'));
  $('accountPass').addEventListener('keydown',e=>{if(e.key==='Enter')auth('login')});
})();
