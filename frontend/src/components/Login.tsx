interface LoginScreenProps {
  username: string;
  setUsername: (username: string) => void;
  gameIdInput: string;
  setGameIdInput: (gameId: string) => void;
  createGame: () => void;
  joinGame: () => void;
  error: string;
  showJoinGame: boolean;
  setShowJoinGame: (show: boolean) => void;
}

const Login = ({
  username,
  setUsername,
  gameIdInput,
  setGameIdInput,
  createGame,
  joinGame,
  error,
  showJoinGame,
  setShowJoinGame
}: LoginScreenProps) => {
  return (
    
    <div className="flex items-center justify-center h-screen bg-gray-700">
      <div className="p-6 bg-white shadow rounded space-y-4 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center">Маfia Game</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your name"
            />
          </div>
          
          {showJoinGame ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Game Code</label>
              <input
                type="text"
                value={gameIdInput}
                onChange={(e) => setGameIdInput(e.target.value.toUpperCase())}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter game code"
                maxLength={6}
              />
            </div>
          ) : null}
          
          <div className="flex flex-col space-y-2">
            {showJoinGame ? (
              <>
                <button
                  onClick={joinGame}
                  disabled={!username || !gameIdInput}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 cursor-pointer"
                >
                  Join Game
                </button>
                <button
                  onClick={() => setShowJoinGame(false)}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded cursor-pointer"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={createGame}
                  disabled={!username}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 cursor-pointer"
                >
                  Create New Game
                </button>
                <button
                  onClick={() => setShowJoinGame(true)}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded cursor-pointer"
                >
                  Join Existing Game
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;