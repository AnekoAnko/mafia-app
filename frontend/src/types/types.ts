export interface Player {
    id: string;
    name: string;
    isAlive?: boolean;
  }
  
  export interface Message {
    sender: string;
    message: string;
    id: string;
    isSystem?: boolean;
  }
  
  export interface GameState {
    gameId: string | null;
    isHost: boolean;
    players: Player[];
    started: boolean;
    messages: Message[];

  }