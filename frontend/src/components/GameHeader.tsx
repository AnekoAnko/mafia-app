

interface GameHeaderProps {
  gameId: string;

}

const GameHeader = ({ gameId }: GameHeaderProps) => {
  return (
    <div className="bg-indigo-600 text-white p-4 shadow-md">
      <div className="flex justify-between items-center">
        {/* Назва як в чаті */}
        <div>
          <h1 className="text-lg font-semibold">🔵 Відправила message</h1>
          <p className="text-xs text-gray-400">Chat ID: {gameId}</p>
        </div>

      </div>
    </div>
  );
};


export default GameHeader;