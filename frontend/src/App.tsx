import { useState } from 'react';
import { useSocket } from './hooks/useSocket';
import LoginScreen from './components/Login';
import Header from './components/Header';
import MembersList from './components/MembersList';
import ChatArea from './components/ChatArea';
import useMobile from './hooks/useMobile';

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

  const isMobile = useMobile();
  
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
      <Header
        gameId={gameState.gameId}
      />
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {!isMobile && 
          <MembersList 
            players={gameState.players}
            isHost={gameState.isHost}
            started={gameState.started}
            socketId={socket?.id}
          />
        }
        
        <ChatArea 
          messages={gameState.messages}
          message={message}
          setMessage={setMessage}
          sendMessage={handleSendMessage}
          socketId={socket?.id}
        />
      </div>
      
    </div>
  );
};

export default App;