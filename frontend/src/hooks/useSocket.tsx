import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Message, PHASES } from '../types/types';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState('');
  
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    isHost: false,
    players: [],
    started: false,
    phase: PHASES.LOBBY,
    role: null,
    messages: [],
    timeLeft: 0,
    dayCount: 0,
    lastKilled: null,
    winner: null,
    votedFor: null,
    nightActionDone: false
  });
  
  useEffect(() => {
    const newSocket = io("http://localhost:3000");
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
            message: `Chat created! Share this code with friends: ${gameId}`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
      
      navigator.clipboard.writeText(gameId)
        .then(() => {
          addSystemMessage(`Chat code ${gameId} copied to clipboard!`);
        })
        .catch(() => {
          addSystemMessage(`Your chat code is: ${gameId}`);
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
            message: `You joined game ${gameId}`,
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
            message: `${newPlayer.name} joined the game`,
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
            message: `${leftPlayer?.name || 'A player'} left the game`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('gameStarted', ({ role, players }) => {
      setGameState(prev => ({
        ...prev,
        started: true,
        role,
        players,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `Game started! You are a ${role.name} (${role.description})`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('phaseChange', ({ phase, dayCount, duration, lastKilled, gameOver, winner }) => {
      let message = '';
      
      switch (phase) {
        case PHASES.NIGHT:
          message = `Night ${dayCount} has begun. The town sleeps...`;
          break;
        case PHASES.DAY:
          message = `Day ${dayCount} has begun. Discuss who might be suspicious!`;
          if (lastKilled) {
            message = `${lastKilled.name} was killed during the night! ${message}`;
          } else {
            message = `No one was killed during the night! ${message}`;
          }
          break;
        case PHASES.VOTING:
          message = `Voting phase has begun. Vote for who you think is suspicious!`;
          break;
        case PHASES.ENDED:
          message = `Game Over! ${winner === 'town' ? 'The Town' : 'The Mafia'} wins!`;
          break;
      }
      
      setGameState(prev => ({
        ...prev,
        phase,
        dayCount,
        timeLeft: duration,
        lastKilled,
        winner: gameOver ? winner : null,
        votedFor: null,
        nightActionDone: false,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('updateTimer', ({ timeLeft, phase }) => {
      setGameState(prev => ({
        ...prev,
        timeLeft,
        phase
      }));
    });
    
    socket.on('receiveMessage', (message: Message) => {
      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, message]
      }));
    });
    
    socket.on('playerVoted', ({ voterName, targetName }) => {
      setGameState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `${voterName} voted for ${targetName}`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('actionConfirmed', ({ action, targetName }) => {
      let actionText = '';
      
      switch (action) {
        case 'kill':
          actionText = `chosen to kill`;
          break;
        case 'protect':
          actionText = `chosen to protect`;
          break;
        case 'investigate':
          actionText = `chosen to investigate`;
          break;
      }
      
      setGameState(prev => ({
        ...prev,
        nightActionDone: true,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `You have ${actionText} ${targetName}`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('mafiaAction', ({ actorName, targetName }) => {
      setGameState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `${actorName} has chosen to kill ${targetName}`,
            id: 'system',
            isSystem: true,
            isMafiaChat: true
          }
        ]
      }));
    });
    
    socket.on('investigationResult', ({ targetName, isMafia }) => {
      setGameState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `Your investigation reveals that ${targetName} is ${isMafia ? 'a member of the Mafia!' : 'not a member of the Mafia.'}`,
            id: 'system',
            isSystem: true
          }
        ]
      }));
    });
    
    socket.on('gameOver', ({ winner, players }) => {
      setGameState(prev => ({
        ...prev,
        winner,
        players,
        phase: PHASES.ENDED,
        messages: [
          ...prev.messages,
          {
            sender: 'System',
            message: `Game Over! ${winner === 'town' ? 'The Town' : 'The Mafia'} wins!`,
            id: 'system',
            isSystem: true
          }
        ]
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
  
  const vote = (targetId: string) => {
    if (!socket) return;
    
    socket.emit('vote', { targetId });
    setGameState(prev => ({ ...prev, votedFor: targetId }));
  };
  
  const performNightAction = (targetId: string, action: string) => {
    if (!socket) return;
    
    socket.emit('nightAction', { targetId, action });
  };
  
  const getNightAction = () => {
    if (!gameState.role) return null;
    
    switch (gameState.role.name) {
      case 'Mafia':
        return 'kill';
      case 'Doctor':
        return 'protect';
      case 'Sheriff':
        return 'investigate';
      default:
        return null;
    }
  };
  
  return {
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
  };
}