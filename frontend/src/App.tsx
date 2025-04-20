import { useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { PHASES } from './types/types';
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
    startGame,
    sendMessage,
    vote,
    performNightAction,
    getNightAction
  } = useSocket();
  
  const canPerformNightAction = () => {
    if (!gameState.role) return false;
    return (
      gameState.phase === PHASES.NIGHT &&
      gameState.role.name !== 'Civilian' &&
      !gameState.nightActionDone
    );
  };
  
  const canVote = () => {
    return gameState.phase === PHASES.VOTING && !gameState.votedFor;
  };
  
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
        started={gameState.started}
        role={gameState.role}
        phase={gameState.phase}
        timeLeft={gameState.timeLeft}
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
          phase={gameState.phase}
          socketId={socket?.id}
          canVote={canVote}
          canPerformNightAction={canPerformNightAction}
          vote={vote}
          votedFor={gameState.votedFor}
          performNightAction={performNightAction}
          getNightAction={getNightAction}
          startGame={startGame}
          winner={gameState.winner}
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