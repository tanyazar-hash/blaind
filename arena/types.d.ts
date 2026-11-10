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
  description: string;
  details: TournamentDetail[];
  displayOrder: number;
  imageUrl: string | null;
  imageAlt: string;
  imageFit?: 'cover' | 'contain';
  imageFocus?: { x: number; y: number };
  /** Optional opaque storage identifier for a future admin backend. Never a credential. */
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
