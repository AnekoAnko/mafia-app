export interface Player {
    id: string;
    name: string;
    isAlive?: boolean;
    role?: Role;
  }
  
  export interface Message {
    sender: string;
    message: string;
    id: string;
    isSystem?: boolean;
    isMafiaChat?: boolean;
  }
  
  export interface GameState {
    gameId: string | null;
    isHost: boolean;
    players: Player[];
    started: boolean;
    phase: string;
    role: Role | null;
    messages: Message[];
    timeLeft: number;
    dayCount: number;
    lastKilled: Player | null;
    winner: string | null;
    votedFor: string | null;
    nightActionDone: boolean;
  }

  export interface Role {
    name: string;
    description: string;
    team: string;
  } 
  
  export const PHASES = {
    LOBBY: 'lobby',
    NIGHT: 'night',
    DAY: 'day',
    VOTING: 'voting',
    RESULTS: 'results',
    ENDED: 'ended'
  };