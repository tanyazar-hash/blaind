export interface Player {
  id: string;
  nickname: string;
  tournamentsPlayed: number;
  wins: number;
  points: number;
}
export interface RankedPlayer extends Player { rank: number }
export interface TournamentDetail { label: string; value: string }
export interface Tournament {
  id: string;
  title: string;
  startsAt: string;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  endsAt?: string | null;
  description: string;
  details: TournamentDetail[];
  displayOrder: number;
  imageUrl: string | null;
  imageAlt: string;
  imageFit?: 'cover' | 'contain';
  imageFocus?: { x: number; y: number };
  /** Optional opaque storage identifier for the admin backend. Never a credential. */
  imageStorageKey?: string | null;
}
export interface PlayersResponse { isDemo?: boolean; updatedAt: string; players: Player[] }
export interface TournamentsResponse { isDemo?: boolean; updatedAt: string; timeZone: string; tournaments: Tournament[] }
export interface ArenaDataSource {
  getPlayers(signal?: AbortSignal): Promise<PlayersResponse>;
  getTournaments(signal?: AbortSignal): Promise<TournamentsResponse>;
}
export type RankingSortField = 'points' | 'wins' | 'tournamentsPlayed';
export type SortDirection = 'asc' | 'desc';

export interface ArenaHero {
 eyebrow: string; titleLine1: string; titleLine2: string; subtitle: string; description: string;
 primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string;
 leadersTitle: string; leadersTag: string; demoLabel: string;
 playersMetricLabel: string; tournamentsMetricLabel: string; scrollCue: string;
 backgroundImageUrl: string | null; backgroundImageStorageKey: string | null; backgroundOpacity: number;
}
export interface ArenaSnapshot {
 revision: number; hero: {updatedAt: string; hero: ArenaHero};
 players: PlayersResponse; tournaments: TournamentsResponse;
}
