import { useState } from 'react';
import { useSocket } from './hooks/useSocket';
import LoginScreen from './components/Login';
import GameHeader from './components/GameHeader';
import PlayerList from './components/PlayerList';
import ChatArea from './components/ChatArea';
import PhaseInfo from './components/PhaseInfo';

const App = () => {
  const [username, setUsername] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [message, setMessage] = useState('');
  const [showJoinGame, setShowJoinGame] = useState(false);
  
  const {
    socket,
    error,
    gameState,
    createGame,
    joinGame,
    sendMessage,
  } = useSocket();
  
  const handleCreateGame = () => {
    createGame(username);
  };
  
  const handleJoinGame = () => {
    joinGame(gameIdInput, username);
  };
  
  const handleSendMessage = () => {
    sendMessage(message);
    setMessage('');
  };
  
  if (!gameState.gameId) {
    return (
      <LoginScreen
        username={username}
        setUsername={setUsername}
        gameIdInput={gameIdInput}
        setGameIdInput={setGameIdInput}
        createGame={handleCreateGame}
        joinGame={handleJoinGame}
        error={error}
        showJoinGame={showJoinGame}
        setShowJoinGame={setShowJoinGame}
      />
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <GameHeader
        gameId={gameState.gameId}
      />
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
        <PlayerList 
          players={gameState.players}
          isHost={gameState.isHost}
          started={gameState.started}
          socketId={socket?.id}
        />
        
        <ChatArea 
          messages={gameState.messages}
          message={message}
          setMessage={setMessage}
          sendMessage={handleSendMessage}
          socketId={socket?.id}
          phase={gameState.phase}
          roleTeam={gameState.role?.team}
        />
      </div>
      
      <PhaseInfo 
        phase={gameState.phase}
        dayCount={gameState.dayCount}
        timeLeft={gameState.timeLeft}
        role={gameState.role}
        votedFor={gameState.votedFor}
        players={gameState.players}
      />
    </div>
  );
};

export default App;