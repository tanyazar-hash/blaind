/** @typedef {import('./types').ArenaDataSource} ArenaDataSource */
/** @typedef {import('./types').PlayersResponse} PlayersResponse */
/** @typedef {import('./types').TournamentsResponse} TournamentsResponse */
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const date=value=>text(value)&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const ensure=(condition,message)=>{if(!condition)throw new TypeError(message)};
function unique(items) {
  const ids=new Set();
  for(const item of items){ensure(text(item.id)&&!ids.has(item.id),'Duplicate or missing ID');ids.add(item.id)}
}
/** @param {unknown} value @returns {PlayersResponse} */
export function validatePlayers(value) {
  ensure(object(value)&&date(value.updatedAt)&&Array.isArray(value.players),'Invalid players response');
  ensure(value.isDemo===undefined||typeof value.isDemo==='boolean','Invalid demo flag');
  unique(value.players);
  for(const player of value.players){
    ensure(object(player)&&text(player.nickname)&&integer(player.tournamentsPlayed)&&integer(player.wins)&&integer(player.points),'Invalid player');
    ensure(player.wins<=player.tournamentsPlayed,'Wins exceed tournaments played');
  }
  return value;
}
/** @param {unknown} value @returns {TournamentsResponse} */
export function validateTournaments(value) {
  ensure(object(value)&&date(value.updatedAt)&&text(value.timeZone)&&Array.isArray(value.tournaments),'Invalid tournaments response');
  try{new Intl.DateTimeFormat('ru',{timeZone:value.timeZone}).format()}catch{throw new TypeError('Invalid timezone')}
  ensure(value.isDemo===undefined||typeof value.isDemo==='boolean','Invalid demo flag');
  unique(value.tournaments);
  for(const tournament of value.tournaments){
    ensure(object(tournament)&&text(tournament.title)&&date(tournament.startsAt)&&text(tournament.description),'Invalid tournament');
    ensure(integer(tournament.displayOrder)&&Array.isArray(tournament.details),'Invalid tournament order or details');
    ensure(tournament.imageUrl===null||typeof tournament.imageUrl==='string','Invalid image URL field');
    ensure(typeof tournament.imageAlt==='string','Invalid image description');
    ensure(tournament.details.every(detail=>object(detail)&&text(detail.label)&&text(detail.value)),'Invalid tournament detail');
    ensure(tournament.imageFit===undefined||['cover','contain'].includes(tournament.imageFit),'Invalid image fit');
    if(tournament.imageFocus!==undefined)ensure(object(tournament.imageFocus)&&
      ['x','y'].every(key=>Number.isFinite(tournament.imageFocus[key])&&tournament.imageFocus[key]>=0&&tournament.imageFocus[key]<=100),'Invalid image focus');
  }
  return value;
}

/** Safe public image references: supports local project files and future HTTPS storage URLs.
 * @param {string|null} value @param {string|URL} [base]
 * @returns {string|null}
 */
export function resolveImageUrl(value,base=import.meta.url) {
  if(!value?.trim())return null;
  try{
    const url=new URL(value,base);
    return ['https:','http:'].includes(url.protocol) ? url.href : null;
  }catch{return null}
}

/** Replace the two URLs with API endpoints; the UI and response contracts stay identical.
 * @param {{playersUrl?:string|URL,tournamentsUrl?:string|URL,fetchImpl?:typeof fetch}} options
 * @returns {ArenaDataSource}
 */
export function createArenaDataSource({
  playersUrl=new URL('./data/players.json',import.meta.url),
  tournamentsUrl=new URL('./data/tournaments.json',import.meta.url),
  fetchImpl=globalThis.fetch
}={}) {
  async function get(url,validate,signal) {
    const timeout=AbortSignal.timeout(12000);
    const response=await fetchImpl(url,{cache:'no-cache',signal:signal ? AbortSignal.any([signal,timeout]) : timeout});
    if(!response.ok)throw new Error('Arena request failed: '+response.status);
    return validate(await response.json());
  }
  return {
    getPlayers:signal=>get(playersUrl,validatePlayers,signal),
    getTournaments:signal=>get(tournamentsUrl,validateTournaments,signal)
  };
}
const staticSource=createArenaDataSource();
let inflight,staticOnly=false;
async function snapshot(){
 if(inflight)return inflight;
 inflight=(async()=>{
  if(staticOnly)return null;
  const response=await fetch('/api/arena',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(response.status===404){staticOnly=true;return null}
  if(!response.ok)throw new Error('Arena request failed: '+response.status);
  return response.json();
 })().finally(()=>{inflight=null});return inflight;
}
export const arenaDataSource={
 getPlayers:async()=>{const s=await snapshot();return s?validatePlayers(s.players):staticSource.getPlayers()},
 getTournaments:async()=>{const s=await snapshot();return s?validateTournaments(s.tournaments):staticSource.getTournaments()},
 getSnapshot:snapshot
};
