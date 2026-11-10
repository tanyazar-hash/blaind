/** One rule for both the public schedule and its live total. Legacy records remain supported. */
export function isActiveTournament(tournament,now=Date.now()){
 if(['completed','cancelled'].includes(tournament.status))return false;
 const start=Date.parse(tournament.startsAt),end=tournament.endsAt?Date.parse(tournament.endsAt):null;
 if(!Number.isFinite(start)||end!==null&&!Number.isFinite(end))return false;
 if(end!==null)return end>now;
 if(tournament.status==='active')return true;
 return start>=now;
}
export function activeTournaments(tournaments,now=Date.now()){
 return tournaments.filter(t=>isActiveTournament(t,now)).sort((a,b)=>a.displayOrder-b.displayOrder||Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
}
