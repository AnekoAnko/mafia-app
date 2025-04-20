import { Player, PHASES } from '../types/types';

interface PlayerListProps {
  players: Player[];
  isHost: boolean;
  started: boolean;
  phase: string;
  socketId: string | undefined;
  canVote: () => boolean;
  canPerformNightAction: () => boolean;
  vote: (targetId: string) => void;
  votedFor: string | null;
  performNightAction: (targetId: string, action: string) => void;
  getNightAction: () => string | null;
  startGame: () => void;
  winner: string | null;
}

const PlayerList = ({
  players,
  isHost,
  started,
  phase,
  socketId,
  canVote,
  canPerformNightAction,
  vote,
  votedFor,
  performNightAction,
  getNightAction,
  startGame,
  winner
}: PlayerListProps) => {
  return (
    <div className="w-1/4 bg-white p-4 border-r overflow-y-auto">
      <h2 className="text-lg font-semibold mb-2">Players</h2>
      <ul className="space-y-2">
        {players.map(player => (
          <li 
            key={player.id}
            className={`p-2 rounded ${
              !player.isAlive 
                ? 'bg-gray-200 text-gray-500 line-through' 
                : player.id === socketId 
                  ? 'bg-indigo-100' 
                  : 'bg-white'
            }`}
          >
            <div className="flex justify-between items-center">
              <span>
                {player.name} 
                {player.id === socketId && ' (You)'}
                {!started && isHost && player.id === players[0].id && ' (Host)'}
              </span>
              
              {canVote() && player.id !== socketId && player.isAlive && (
                <button
                  onClick={() => vote(player.id)}
                  className={`px-2 py-1 text-sm rounded ${
                    votedFor === player.id
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 hover:bg-red-500 hover:text-white'
                  }`}
                >
                  Vote
                </button>
              )}
              
              {canPerformNightAction() && player.isAlive && (
                ((player.id !== socketId) || (getNightAction() === 'protect')) && (
                  <button
                    onClick={() => performNightAction(player.id, getNightAction() || '')}
                    className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {getNightAction() === 'kill' && 'Kill'}
                    {getNightAction() === 'protect' && 'Protect'}
                    {getNightAction() === 'investigate' && 'Investigate'}
                  </button>
                )
              )}
            </div>
            
            {phase === PHASES.ENDED && player.role && (
              <div className="text-sm text-gray-500 mt-1">
                {player.role.name} ({player.role.team})
              </div>
            )}
          </li>
        ))}
      </ul>
      
      {isHost && phase === PHASES.LOBBY && (
        <button
          onClick={startGame}
          disabled={players.length < 4}
          className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded disabled:opacity-50"
        >
          Start Game {players.length < 4 && `(Need ${4 - players.length} more)`}
        </button>
      )}
      
      {phase === PHASES.ENDED && winner && (
        <div className="mt-4 p-4 bg-indigo-100 rounded text-center">
          <h3 className="text-lg font-bold">
            {winner === 'town' ? 'Town Wins!' : 'Mafia Wins!'}
          </h3>
          <p>Thanks for playing!</p>
        </div>
      )}
    </div>
  );
};

export default PlayerList;