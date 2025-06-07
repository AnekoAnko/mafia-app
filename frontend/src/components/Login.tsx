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
    <div className="min-h-screen flex justify-center items-center">
      <div
        className="hidden lg:flex  bg-cover bg-center"
        style={{ backgroundImage: "url('/chat-illustration.jpg')" }}
      />

      <div className="flex flex-col justify-center w-full lg:w-1/2 px-8 py-12 bg-white">
        <h1 className="text-4xl font-bold text-indigo-600 mb-2">ВІДПРАВИЛА MESSAGE</h1>
        <p className="text-gray-500 mb-8">
          {showJoinGame ? 'Долучитися до чату' : 'Створити новий чат'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded mb-6">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Ім'я
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ваше ім'я"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={gameIdInput}
              onChange={e => setGameIdInput(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-4">
            {showJoinGame ? (
              <>
                <button
                  onClick={joinGame}
                  disabled={!username || !gameIdInput}
                  className="w-full py-2 cursor-pointer rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                >
                  Долучитися до чату
                </button>
                <button
                  onClick={() => setShowJoinGame(false)}
                  className="w-full py-2 cursor-pointer rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Створити чат
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={createGame}
                  disabled={!username || !gameIdInput}
                  className="w-full py-2 cursor-pointer rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                >
                  Створити чат
                </button>
                <button
                  onClick={() => setShowJoinGame(true)}
                  className="w-full py-2 cursor-pointer rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Долучитися до чату
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