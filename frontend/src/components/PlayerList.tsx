import { useState } from 'react';
import { Player } from '../types/types';

interface PlayerListProps {
  players: Player[];
  isHost: boolean;
  started: boolean;
  socketId: string | undefined;
}

const PlayerList = ({
  players,
  isHost,
  started,
  socketId,
}: PlayerListProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  return (
    <div className="relative w-1/4 bg-white p-4 border-r overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4">Players</h2>
      <ul className="space-y-3">
        {players.map(player => {
          const isMe = player.id === socketId;
          const alive = player.isAlive;
          return (
            <li
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className={`
                flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition
                ${!alive ? 'opacity-50 line-through' : ''}
                ${isMe ? 'bg-indigo-50' : 'hover:bg-gray-100'}
              `}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 flex items-center justify-center rounded-full text-lg
                  ${alive ? 'bg-green-200 text-green-800' : 'bg-gray-300 text-gray-600'}
                `}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium truncate">{player.name}</span>
                  {isMe && <span className="text-xs text-indigo-600">You</span>}
                  {!started && isHost && player.id === players[0].id && (
                    <span className="text-xs text-green-600">Host</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 flex items-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1
                      ${alive ? 'bg-green-400' : 'bg-red-400'}`}
                  />
                  {alive ? 'Alive' : 'Dead'}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Fullscreen Player Profile Modal */}
      {selectedPlayer && (
  <div className="fixed inset-0 z-50 flex justify-center items-center pointer-events-none">
    <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-xl animate-fade-in relative pointer-events-auto">
      <button
        onClick={() => setSelectedPlayer(null)}
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl cursor-pointer"
      >
        &times;
      </button>

      <h3 className="text-2xl font-bold mb-4 text-center">{selectedPlayer.name}</h3>

      <div className="text-center mb-6">
        <div
          className={`w-16 h-16 mx-auto mb-2 flex items-center justify-center rounded-full text-3xl
            ${selectedPlayer.isAlive ? 'bg-green-200 text-green-800' : 'bg-gray-300 text-gray-600'}
          `}
        >
          {selectedPlayer.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-sm text-gray-600">
          Status:{' '}
          <span className={selectedPlayer.isAlive ? 'text-green-600' : 'text-red-600'}>
            {selectedPlayer.isAlive ? 'Alive' : 'Dead'}
          </span>
        </div>
        <div className="text-sm text-gray-600 mt-2 font-mono">
          ID: {selectedPlayer.id}
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default PlayerList;
