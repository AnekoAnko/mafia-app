import { Player, PHASES, Role } from '../types/types';

interface PhaseInfoProps {
  phase: string;
  dayCount: number;
  timeLeft: number;
  role?: Role | null;
  votedFor: string | null;
  players: Player[];
}

const PhaseInfo = ({
  phase,
  dayCount,
  timeLeft,
  role,
  votedFor,
  players
}: PhaseInfoProps) => {

  if (phase === PHASES.LOBBY) {
    return null;
  }
  
  return (
    <div className="bg-gray-200 p-4">
      <div className="max-w-4xl mx-auto">
        {phase === PHASES.NIGHT && (
          <div className="text-center">
            <h2 className="text-lg font-semibold">Night {dayCount}</h2>
            <p>
              {role?.team === 'mafia' 
                ? "Choose someone to kill! You can chat with other mafia members." 
                : role?.name === 'Doctor' 
                  ? "Choose someone to protect for the night!" 
                  : role?.name === 'Sheriff' 
                    ? "Choose someone to investigate!" 
                    : "The town sleeps... Wait for night to end."}
            </p>
            <p className="text-sm mt-1">Time remaining: {timeLeft}s</p>
          </div>
        )}
        
        {phase === PHASES.DAY && (
          <div className="text-center">
            <h2 className="text-lg font-semibold">Day {dayCount}</h2>
            <p>Discuss who you think might be suspicious!</p>
            <p className="text-sm mt-1">Time remaining: {timeLeft}s</p>
          </div>
        )}
        
        {phase === PHASES.VOTING && (
          <div className="text-center">
            <h2 className="text-lg font-semibold">Voting Time</h2>
            <p>Vote for who you think is a member of the Mafia!</p>
            <p className="text-sm mt-1">Time remaining: {timeLeft}s</p>
            {votedFor && (
              <p className="text-sm font-semibold mt-2">
                You voted for: {players.find(p => p.id === votedFor)?.name}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhaseInfo;