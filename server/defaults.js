import players from '../arena/data/players.json' with {type:'json'};
import tournaments from '../arena/data/tournaments.json' with {type:'json'};
import hero from '../arena/data/hero.json' with {type:'json'};

export function defaultDocument(){
  return structuredClone({
    hero,players:players.players,tournaments:tournaments.tournaments,
    settings:{timeZone:tournaments.timeZone,playersIsDemo:true,tournamentsIsDemo:true},
    ratingUpdatedAt:players.updatedAt,tournamentsUpdatedAt:tournaments.updatedAt,heroUpdatedAt:players.updatedAt
  });
}
export function publicSnapshot(row){
  const d=row.document;
  return {
    revision:row.version,
    hero:{updatedAt:d.heroUpdatedAt,hero:d.hero},
    players:{updatedAt:d.ratingUpdatedAt,isDemo:d.settings.playersIsDemo,players:d.players},
    tournaments:{updatedAt:d.tournamentsUpdatedAt,isDemo:d.settings.tournamentsIsDemo,timeZone:d.settings.timeZone,tournaments:d.tournaments}
  };
}
