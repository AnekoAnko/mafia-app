import { Role } from '../types/types';

interface GameHeaderProps {
  gameId: string;
  started: boolean;
  role: Role | null;
  phase: string;
  timeLeft: number;
}

const GameHeader = ({ gameId, started, role, phase, timeLeft }:GameHeaderProps) => {
    console.log(gameId)
  return (
    <div className="bg-indigo-600 text-white p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Mafia Game</h1>
          <p className="text-sm">Game ID: {gameId}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">
            {started 
              ? `You are: ${role?.name} (${role?.team})` 
              : 'Waiting to start...'}
          </p>
          <p className="text-sm">
            {phase !== 'lobby' && `Phase: ${phase} | Time: ${timeLeft}s`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GameHeader;