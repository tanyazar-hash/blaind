/** @typedef {import('./types').Player} Player */
/** @typedef {import('./types').RankedPlayer} RankedPlayer */
/** @typedef {import('./types').RankingSortField} RankingSortField */
const names = new Intl.Collator('ru', {sensitivity:'base',numeric:true});

/** Assign official places before search or display sorting; never mutate source data.
 * @param {Player[]} players
 * @returns {RankedPlayer[]}
 */
export function rankPlayers(players) {
  return [...players].sort((a,b)=>
    b.points-a.points || b.wins-a.wins ||
    names.compare(a.nickname,b.nickname) || a.id.localeCompare(b.id)
  ).map((player,index)=>({...player,rank:index+1}));
}

/** @param {RankedPlayer[]} ranked
 * @param {{query?:string,sortBy?:RankingSortField,direction?:'asc'|'desc'}} options
 * @returns {RankedPlayer[]}
 */
export function selectPlayers(ranked,{query='',sortBy='points',direction='desc'}={}) {
  const field=['points','wins','tournamentsPlayed'].includes(sortBy) ? sortBy : 'points';
  const needle=query.normalize('NFKC').trim().toLocaleLowerCase('ru');
  const sign=direction==='asc' ? 1 : -1;
  return ranked.filter(player=>player.nickname.normalize('NFKC').toLocaleLowerCase('ru').includes(needle))
    .sort((a,b)=>sign*(a[field]-b[field]) || a.rank-b.rank);
}
