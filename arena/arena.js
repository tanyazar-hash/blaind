import {sitePath} from '../shared/paths.js';
import {revealContent as reveal,clubText} from '../shared/site.js';
import {activeTournaments} from './tournaments.js';
import {arenaDataSource,resolveImageUrl} from './data-source.js';
import {rankPlayers,selectPlayers} from './ranking.js';

/** @typedef {import('./types').RankedPlayer} RankedPlayer */
/** @typedef {import('./types').Tournament} Tournament */
const $=selector=>document.querySelector(selector);
const hasRanking=!!$('#ranking'),hasTournaments=!!$('#tournaments');
if(hasRanking&&location.hash==='#tournaments')location.replace(sitePath('tournaments/'));
const numbers=new Intl.NumberFormat('ru-RU');
const plural=new Intl.PluralRules('ru-RU');
const defaultZone='Asia/Novosibirsk';
const state={ranked:[],query:'',sortBy:'points',direction:'desc',rows:new Map()};
let returnFocus=null, tournamentPayload=null, activeTournamentIds;
let liveRevision,liveBusy=false,livePlayers,liveTournaments;
const tableWrap=$('#ranking-table-wrap'), tbody=$('#ranking-body');
const rankingMessage=$('#ranking-message'), tournamentsMessage=$('#tournaments-message');
const search=$('#player-search'),sort=$('#ranking-sort'),direction=$('#sort-direction');
const summary=$('#ranking-summary'),clear=$('#clear-search');
const viewer=$('#image-viewer'),viewerImage=$('#viewer-image'),viewerError=$('#viewer-error');


function element(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=clubText(text);
  return node;
}
function word(count,forms){return forms[{one:0,few:1,other:2}[plural.select(count)]??2]}
function formatDate(value,options={},zone=defaultZone){
  return new Intl.DateTimeFormat('ru-RU',{timeZone:zone,...options}).format(new Date(value));
}
function panelMessage(container,text,action,label='Повторить',alert=false){
  container.replaceChildren(element('p','',text));
  container.setAttribute('role',alert?'alert':'status');
  container.hidden=false;
  if(action){
    const button=element('button','',label);button.type='button';
    button.addEventListener('click',action);container.append(button);
  }
}
function setFiltersEnabled(enabled){
  search.disabled=!enabled;sort.disabled=!enabled;direction.disabled=!enabled;
  document.querySelectorAll('[data-column-sort]').forEach(button=>{button.disabled=!enabled});
}
/** @param {RankedPlayer} player */
function playerRow(player){
  const row=element('tr',(player.rank<=18?'rank-finalist ':'')+(player.rank<=3?'rank-top rank-'+player.rank:''));
  row.dataset.playerId=player.id;row.dataset.rank=String(player.rank);
  const rank=element('td','rank-cell');
  rank.append(element('span','rank-badge',String(player.rank).padStart(2,'0')));
  if(player.rank<=18)rank.setAttribute('aria-label','Место '+player.rank+' · входит в первые 18');
  const played=element('td','player-played',numbers.format(player.tournamentsPlayed));played.dataset.label='Турниры';
  const wins=element('td','player-wins',numbers.format(player.wins));wins.dataset.label='Победы';
  row.append(rank,element('td','player-name',player.nickname),played,wins,
    element('td','player-points',numbers.format(player.points)));
  return row;
}
function renderRanking(){
  const players=selectPlayers(state.ranked,state);
  const fragment=document.createDocumentFragment();
  for(const player of players){
    let row=state.rows.get(player.id);
    if(!row){row=playerRow(player);state.rows.set(player.id,row)}
    fragment.append(row);
  }
  tbody.replaceChildren(fragment);
  tableWrap.hidden=!players.length;
  rankingMessage.hidden=!!players.length;
  if(!players.length){
    panelMessage(rankingMessage,state.ranked.length?'Игрок не найден. Попробуйте другой никнейм.':'Рейтинг пока пуст. Первые результаты появятся после турниров.',
      state.query?resetSearch:null,'Сбросить поиск');
  }
  const names={points:'очкам',wins:'победам',tournamentsPlayed:'сыгранным турнирам'};
  summary.textContent=state.query
    ? 'Найдено '+players.length+' из '+state.ranked.length+' · по '+names[state.sortBy]
    : numbers.format(players.length)+' '+word(players.length,['игрок','игрока','игроков'])+' · по '+names[state.sortBy];
  sort.value=state.sortBy;clear.hidden=!state.query;
  const ascending=state.direction==='asc';
  direction.dataset.direction=state.direction;
  direction.querySelector('.direction-label').textContent=ascending?'По возрастанию':'По убыванию';
  direction.setAttribute('aria-label','Изменить направление сортировки: сейчас '+(ascending?'по возрастанию':'по убыванию'));
  document.querySelectorAll('th[data-sort]').forEach(th=>{
    if(th.dataset.sort===state.sortBy)th.setAttribute('aria-sort',ascending?'ascending':'descending');
    else th.removeAttribute('aria-sort');
  });

}
function resetSearch(){
  state.query='';search.value='';renderRanking();search.focus({preventScroll:true});
}
async function loadPlayers(provided){
  if(!hasRanking)return;
  setFiltersEnabled(false);$('#ranking').setAttribute('aria-busy','true');
  tableWrap.hidden=true;
  panelMessage(rankingMessage,'Загружаем рейтинг…');
  try{
    const payload=provided?.players?provided:await arenaDataSource.getPlayers();
    state.ranked=rankPlayers(payload.players);state.rows.clear();
    const updated=$('#ranking-updated');
    updated.dateTime=payload.updatedAt;
    updated.textContent=formatDate(payload.updatedAt,{day:'numeric',month:'long',year:'numeric'});
    livePlayers=JSON.stringify(payload);setFiltersEnabled(true);renderRanking();
  }catch(error){
    console.warn('Arena rating unavailable:',error);
    summary.textContent='Рейтинг временно недоступен';
    panelMessage(rankingMessage,'Не удалось загрузить рейтинг. Попробуйте ещё раз.',loadPlayers,'Повторить',true);
  }finally{$('#ranking').setAttribute('aria-busy','false')}
}

function toggleDetails(button,panel){
  const opening=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(opening));
  panel.hidden=!opening;
}
function openImage(tournament,url,caption,trigger){
  returnFocus=trigger;
  $('#viewer-title').textContent=clubText(tournament.title);
  $('#viewer-caption').textContent=caption;
  viewerError.hidden=true;viewerImage.hidden=false;
  viewerImage.alt=clubText(tournament.imageAlt)||('Афиша турнира '+tournament.title);
  viewerImage.onerror=()=>{viewerImage.hidden=true;viewerError.hidden=false};
  viewerImage.src=url;
  viewer.showModal();document.body.classList.add('image-open');
  $('#close-viewer').focus({preventScroll:true});
}
/** @param {Tournament} tournament */
function tournamentCard(tournament,zone){
  const card=element('article','tournament-card arena-reveal');card.dataset.tournamentId=tournament.id;
  const titleId='title-'+encodeURIComponent(tournament.id);
  card.setAttribute('aria-labelledby',titleId);
  const media=element('button','poster-trigger');media.type='button';media.disabled=true;
  const placeholder=element('div','poster-placeholder');placeholder.setAttribute('aria-hidden','true');
  const brand=element('img');brand.src=sitePath('assets/club-logo.svg');brand.alt='';brand.width=600;brand.height=300;
  placeholder.append(brand,element('span','','БЛАИНД / ТУРНИРЫ'));
  const zoom=element('span','poster-zoom');zoom.setAttribute('aria-hidden','true');zoom.append(element('span','arrow-icon'));
  media.append(placeholder,zoom);
  const date=formatDate(tournament.startsAt,{weekday:'short',day:'numeric',month:'long'},zone);
  const time=formatDate(tournament.startsAt,{hour:'2-digit',minute:'2-digit'},zone);
  const caption=date+' · '+time+' · '+zoneName(zone,tournament.startsAt);
  const imageUrl=resolveImageUrl(tournament.imageUrl);
  if(imageUrl){
    const image=element('img');image.alt=clubText(tournament.imageAlt)||('Афиша турнира '+tournament.title);
    image.loading='lazy';image.decoding='async';image.width=1200;image.height=800;
    image.style.objectFit=tournament.imageFit||'cover';
    if(tournament.imageFocus)image.style.objectPosition=tournament.imageFocus.x+'% '+tournament.imageFocus.y+'%';
    image.onload=()=>{media.classList.add('has-image');media.disabled=false;media.setAttribute('aria-label','Открыть изображение турнира '+tournament.title)};
    image.onerror=()=>{image.remove();media.classList.remove('has-image');media.disabled=true;media.setAttribute('aria-label','Афиша турнира '+tournament.title+' пока не добавлена')};
    media.append(image);image.src=imageUrl;
    media.addEventListener('click',()=>{if(media.classList.contains('has-image'))openImage(tournament,image.currentSrc||imageUrl,caption,media)});
  }else media.setAttribute('aria-label','Афиша турнира '+tournament.title+' пока не добавлена');
  const body=element('div','tournament-body'),dateLine=element('div','tournament-date');
  const when=element('time','',date);when.dateTime=tournament.startsAt;
  dateLine.append(when,element('span','',time));
  const title=element('h2','',tournament.title);title.id=titleId;
  body.append(dateLine,title,element('p','tournament-description',tournament.description));
  if(tournament.details.length){
    const button=element('button','details-toggle','О турнире');button.type='button';
    const panel=element('div','details-content');panel.id='details-'+titleId;panel.hidden=true;
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);
    button.append(element('span','details-plus'));
    const dl=element('dl');
    for(const detail of tournament.details){const row=element('div');row.append(element('dt','',detail.label),element('dd','',detail.value));dl.append(row)}
    panel.append(dl);body.append(button,panel);
    button.addEventListener('click',()=>toggleDetails(button,panel));
  }
  const signup=element('a','btn tournament-signup','Записаться');const arrow=element('span','arrow-icon');arrow.setAttribute('aria-hidden','true');signup.append(arrow);signup.href='https://t.me/asushedulebot';signup.setAttribute('aria-label','Записаться на турнир '+tournament.title);body.append(signup);
  card.append(media,body);
  return card;
}
function zoneName(zone,at){
  const names={'Asia/Novosibirsk':'Барнаул','Asia/Barnaul':'Барнаул','Europe/Moscow':'Москва'};
  const offset=new Intl.DateTimeFormat('ru',{timeZone:zone,timeZoneName:'shortOffset'})
    .formatToParts(new Date(at)).find(part=>part.type==='timeZoneName').value.replace('GMT','UTC');
  return names[zone]?names[zone]+' · '+offset:offset;
}
async function loadTournaments(provided){
  if(!hasTournaments)return;
  $('#tournaments').setAttribute('aria-busy','true');
  panelMessage(tournamentsMessage,'Загружаем расписание…');
  const grid=$('#tournaments-grid');grid.replaceChildren();
  try{
    const payload=provided?.tournaments?provided:await arenaDataSource.getTournaments();
    tournamentPayload=payload;liveTournaments=JSON.stringify(payload);
    const tournaments=activeTournaments(payload.tournaments);
    activeTournamentIds=tournaments.map(t=>t.id).join('|');
    $('#tournament-timezone').textContent=zoneName(payload.timeZone,payload.updatedAt);
    if(!tournaments.length){panelMessage(tournamentsMessage,'Новые турниры скоро появятся.');return}
    grid.replaceChildren(...tournaments.map(tournament=>tournamentCard(tournament,payload.timeZone)));
    tournamentsMessage.hidden=true;reveal();
  }catch(error){
    console.warn('Arena tournaments unavailable:',error);
    panelMessage(tournamentsMessage,'Не удалось загрузить расписание. Попробуйте ещё раз.',loadTournaments,'Повторить',true);
  }finally{$('#tournaments').setAttribute('aria-busy','false')}
}

$('#ranking-filters')?.addEventListener('submit',event=>event.preventDefault());
search?.addEventListener('input',()=>{state.query=search.value;renderRanking()});
clear?.addEventListener('click',resetSearch);
sort?.addEventListener('change',()=>{state.sortBy=sort.value;state.direction='desc';renderRanking()});
direction?.addEventListener('click',()=>{state.direction=state.direction==='desc'?'asc':'desc';renderRanking()});
document.querySelectorAll('[data-column-sort]').forEach(button=>button.addEventListener('click',()=>{
  const field=button.dataset.columnSort;
  if(state.sortBy===field)state.direction=state.direction==='desc'?'asc':'desc';
  else{state.sortBy=field;state.direction='desc'}
  renderRanking();
}));
$('#close-viewer')?.addEventListener('click',()=>viewer.close());
viewer?.addEventListener('click',event=>{
  if(event.target!==viewer)return;
  const rect=viewer.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)viewer.close();
});
viewer?.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...viewer.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')]
    .filter(node=>node.getClientRects().length);
  if(!controls.length){event.preventDefault();return}
  const first=controls[0],last=controls.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||!viewer.contains(active))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(active===last||!viewer.contains(active))){event.preventDefault();first.focus()}
});
viewer?.addEventListener('close',()=>{
  document.body.classList.remove('image-open');
  viewerImage.onerror=null;viewerImage.removeAttribute('src');
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  returnFocus=null;
});

reveal();
void loadPlayers();
void loadTournaments();

function refreshTournamentClock(){
 if(tournamentPayload&&activeTournaments(tournamentPayload.tournaments).map(t=>t.id).join('|')!==activeTournamentIds)void loadTournaments(tournamentPayload);
}
async function refreshLive(){if(document.hidden||liveBusy)return;liveBusy=true;try{const s=await arenaDataSource.getSnapshot();if(!s||s.revision===liveRevision){refreshTournamentClock();return}const expanded=[...document.querySelectorAll('.details-toggle[aria-expanded="true"]')].map(n=>n.closest('[data-tournament-id]').dataset.tournamentId);const playersKey=JSON.stringify(s.players),tournamentsKey=JSON.stringify(s.tournaments);await Promise.all([playersKey!==livePlayers?loadPlayers(s.players):null,tournamentsKey!==liveTournaments?loadTournaments(s.tournaments):null]);livePlayers=playersKey;liveTournaments=tournamentsKey;for(const id of expanded){const card=[...document.querySelectorAll('[data-tournament-id]')].find(n=>n.dataset.tournamentId===id);if(card?.querySelector('.details-toggle')){card.querySelector('.details-toggle').setAttribute('aria-expanded','true');card.querySelector('.details-content').hidden=false}}liveRevision=s.revision}catch{refreshTournamentClock();/* Keep the last successfully rendered data during a network interruption. */}finally{liveBusy=false}}
setInterval(refreshLive,4000);window.addEventListener('focus',refreshLive);document.addEventListener('visibilitychange',refreshLive);if('BroadcastChannel'in window)new BroadcastChannel('blaind-arena').onmessage=refreshLive;
