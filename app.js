const DEFAULT_URL = 'https://raw.githubusercontent.com/opensourceflix/OpenSourceFlix/refs/heads/main/papaos.m3u8';
const state = { channels: [], category: 'সব', query: '', active: null, hls: null, favorites: new Set(JSON.parse(localStorage.getItem('cricbd-favorites') || '[]')) };
const $ = id => document.getElementById(id);
const els = { video:$('video'), placeholder:$('videoPlaceholder'), loading:$('videoLoading'), error:$('videoError'), nowPlaying:$('nowPlaying'), playingName:$('playingName'), list:$('channelList'), count:$('channelCount'), tabs:$('categoryTabs'), search:$('searchInput'), status:$('playlistStatus'), updated:$('lastUpdated'), url:$('playlistUrl'), urlBox:$('urlBox'), toast:$('toast') };
els.url.value = localStorage.getItem('cricbd-playlist') || DEFAULT_URL;

function parseM3U(text){
  const lines=text.replace(/\r/g,'').split('\n'); const channels=[];
  for(let i=0;i<lines.length;i++){
    if(!lines[i].trim().startsWith('#EXTINF')) continue;
    const info=lines[i].trim(); let url='';
    for(let j=i+1;j<lines.length;j++){const candidate=lines[j].trim(); if(candidate && !candidate.startsWith('#')){url=candidate;i=j;break}}
    if(!url) continue;
    const attrs={}; info.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>(attrs[k]=v));
    const name=(info.slice(info.lastIndexOf(',')+1).trim() || attrs['tvg-name'] || `চ্যানেল ${channels.length+1}`);
    channels.push({id:attrs['tvg-id']||`${name}-${channels.length}`,name,logo:attrs['tvg-logo']||'',group:attrs['group-title']||'অন্যান্য',url});
  } return channels;
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showToast(message){els.toast.textContent=message;els.toast.classList.add('show');setTimeout(()=>els.toast.classList.remove('show'),2200)}
function buildTabs(){
  const groups=[...new Set(state.channels.map(c=>c.group))].filter(Boolean).slice(0,10);
  els.tabs.innerHTML=['সব','পছন্দের',...groups].map(g=>`<button class="${g===state.category?'active':''}" data-category="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join('');
}
function render(){
  const q=state.query.toLocaleLowerCase();
  const visible=state.channels.filter(c=>(state.category==='সব'||(state.category==='পছন্দের'?state.favorites.has(c.id):c.group===state.category))&&(!q||c.name.toLocaleLowerCase().includes(q)||c.group.toLocaleLowerCase().includes(q)));
  if(!visible.length){els.list.innerHTML='<div class="empty-state">কোনো চ্যানেল পাওয়া যায়নি</div>';return}
  els.list.innerHTML=visible.map(c=>`<div class="channel-row ${state.active?.id===c.id?'active':''}" data-id="${escapeHtml(c.id)}"><div class="channel-logo">${c.logo?`<img src="${escapeHtml(c.logo)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${escapeHtml(c.name.slice(0,2).toUpperCase())}'">`:escapeHtml(c.name.slice(0,2).toUpperCase())}</div><div class="channel-details"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.group)} ${state.active?.id===c.id?'· চলছে':''}</span></div><button class="favorite ${state.favorites.has(c.id)?'on':''}" data-favorite="${escapeHtml(c.id)}" aria-label="পছন্দের তালিকা">${state.favorites.has(c.id)?'★':'☆'}</button><span class="play-dot">▶</span></div>`).join('');
}
async function loadPlaylist(url=els.url.value){
  els.status.textContent='সংযোগ হচ্ছে...'; els.list.innerHTML='<div class="skeleton-list">'+Array(6).fill('<div class="skeleton-row"><i></i><span></span></div>').join('')+'</div>';
  try{
    const response=await fetch(url,{cache:'no-store'}); if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const text=await response.text(); const channels=parseM3U(text); if(!channels.length) throw new Error('No channels');
    state.channels=channels; localStorage.setItem('cricbd-playlist',url); els.count.textContent=channels.length.toLocaleString('bn-BD'); els.status.textContent=`${channels.length.toLocaleString('bn-BD')}টি চ্যানেল প্রস্তুত`; els.updated.textContent='এইমাত্র'; buildTabs();render();showToast('প্লেলিস্ট সফলভাবে লোড হয়েছে');
  }catch(err){
    console.error(err); state.channels=[];els.count.textContent='০';els.status.textContent='লোড করা যায়নি';els.list.innerHTML='<div class="empty-state"><strong>প্লেলিস্ট লোড হয়নি</strong><br><small>ইন্টারনেট বা CORS সেটিং পরীক্ষা করে রিফ্রেশ করুন</small></div>';
  }
}
function playChannel(channel){
  state.active=channel;els.placeholder.classList.add('hidden');els.error.classList.add('hidden');els.loading.classList.remove('hidden');els.nowPlaying.classList.remove('hidden');els.playingName.textContent=channel.name;render();
  if(state.hls){state.hls.destroy();state.hls=null}
  const fail=()=>{els.loading.classList.add('hidden');els.error.classList.remove('hidden')};
  if(window.Hls&&Hls.isSupported()){
    state.hls=new Hls({enableWorker:true,lowLatencyMode:true});state.hls.loadSource(channel.url);state.hls.attachMedia(els.video);state.hls.on(Hls.Events.MANIFEST_PARSED,()=>els.video.play().catch(()=>{}));state.hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)fail()});
  }else if(els.video.canPlayType('application/vnd.apple.mpegurl')){els.video.src=channel.url;els.video.play().catch(fail)}else fail();
}
els.video.addEventListener('playing',()=>els.loading.classList.add('hidden'));
els.video.addEventListener('waiting',()=>state.active&&els.loading.classList.remove('hidden'));
els.video.addEventListener('error',()=>{if(state.active){els.loading.classList.add('hidden');els.error.classList.remove('hidden')}});
els.list.addEventListener('click',e=>{const fav=e.target.closest('[data-favorite]');if(fav){e.stopPropagation();const id=fav.dataset.favorite;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);localStorage.setItem('cricbd-favorites',JSON.stringify([...state.favorites]));render();return}const row=e.target.closest('[data-id]');if(row)playChannel(state.channels.find(c=>c.id===row.dataset.id))});
els.tabs.addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;state.category=button.dataset.category;buildTabs();render()});
els.search.addEventListener('input',e=>{state.query=e.target.value;render()});
$('settingsButton').onclick=()=>els.urlBox.classList.toggle('hidden');$('loadUrlButton').onclick=()=>loadPlaylist();$('reloadButton').onclick=()=>loadPlaylist();
$('themeButton').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('cricbd-theme',document.body.classList.contains('light')?'light':'dark')};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();els.search.focus()}});
if(localStorage.getItem('cricbd-theme')==='light')document.body.classList.add('light');
loadPlaylist();
