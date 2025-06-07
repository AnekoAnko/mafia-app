import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Message } from '../types/types';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState('');
  
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    isHost: false,
    players: [],
    started: false,
    messages: [],
  });
  
  useEffect(() => {
    const newSocket = io("https://mafia-app-7s20.onrender.com");
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, []);
  
  const addSystemMessage = (text: string) => {
    setGameState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          sender: 'System',
          message: text,
          id: 'system',
          isSystem: true
        }
      ]
    }));
  };
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('gameCreated', ({ gameId, players, isHost }) => {
      setGameState(prev => ({
        ...prev,
        gameId,
        players,
        isHost,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `Чат створено! Поділіться кодом з друзями: ${gameId}`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
      
      navigator.clipboard.writeText(gameId)
        .then(() => {
          addSystemMessage(`Код чату ${gameId} скопійовано до буферу!`);
        })
        .catch(() => {
          addSystemMessage(`Ваш код чату: ${gameId}`);
        });
    });
    
    socket.on('gameJoined', ({ gameId, players, isHost }) => {
      setGameState(prev => ({
        ...prev,
        gameId,
        players,
        isHost,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `Ви приєдналися до чату ${gameId}`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('playerJoined', ({ players, newPlayer }) => {
      setGameState(prev => ({
        ...prev,
        players,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `${newPlayer.name} приєднався до чату`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('playerLeft', ({ players, playerId, newHost }) => {
      const leftPlayer = gameState.players.find(p => p.id === playerId);
      
      setGameState(prev => ({
        ...prev,
        players,
        isHost: newHost === socket.id || prev.isHost,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `${leftPlayer?.name || '.'} покинув чат`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
  
    socket.on('receiveMessage', (message: Message) => {
      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, message]
      }));
    });
    
    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
    });
    
    return () => {
      socket.off('gameCreated');
      socket.off('gameJoined');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('gameStarted');
      socket.off('phaseChange');
      socket.off('updateTimer');
      socket.off('receiveMessage');
      socket.off('playerVoted');
      socket.off('actionConfirmed');
      socket.off('mafiaAction');
      socket.off('investigationResult');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [socket, gameState.players]);
  
  const createGame = (username: string) => {
    if (!socket || !username.trim()) return;
    socket.emit('createGame', { username });
  };
  
  const joinGame = (gameId: string, username: string) => {
    if (!socket || !username.trim() || !gameId.trim()) return;
    socket.emit('joinGame', { gameId: gameId.toUpperCase(), username });
  };
  
  const startGame = () => {
    if (!socket) return;
    socket.emit('startGame');
  };
  
  const sendMessage = (message: string) => {
    if (!socket || !message.trim()) return;
    socket.emit('sendMessage', { message });
  };
  
  return {
    socket,
    error,
    gameState,
    createGame,
    joinGame,
    startGame,
    sendMessage,
  };
}
