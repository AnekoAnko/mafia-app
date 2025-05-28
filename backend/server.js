import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['https://sent-message-client.onrender.com'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const games = {};

const ROLES = {
  CIVILIAN: { name: 'Civilian', team: 'town', description: 'Survive and find the mafia' },
  MAFIA: { name: 'Mafia', team: 'mafia', description: 'Eliminate the town' },
  DOCTOR: { name: 'Doctor', team: 'town', description: 'Save one person each night' },
  SHERIFF: { name: 'Sheriff', team: 'town', description: 'Investigate one person each night' }
};

const PHASES = {
  LOBBY: 'lobby',
  NIGHT: 'night',
  DAY: 'day',
  VOTING: 'voting',
  RESULTS: 'results',
  ENDED: 'ended'
};

function createGame(hostId, hostName) {
  const gameId = uuidv4().substring(0, 6).toUpperCase();
  
  games[gameId] = {
    id: gameId,
    host: hostId,
    players: [{
      id: hostId,
      name: hostName,
      isAlive: true,
      role: null,
      votedFor: null
    }],
    started: false,
    phase: PHASES.LOBBY,
    timeLeft: 0,
    dayCount: 0,
    votes: {},
    actions: {},
    protectedPlayer: null,
    investigatedPlayer: null,
    mafiaTarget: null,
    messages: [],
    lastKilled: null,
    timer: null
  };
  
  return gameId;
}

function assignRoles(gameId) {
  const game = games[gameId];
  const players = [...game.players];
  
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  
  const playerCount = players.length;
  let mafiaCount = Math.max(Math.floor(playerCount / 4), 1);
  const doctorCount = 1;
  const sheriffCount = 1;
  const civilianCount = playerCount - mafiaCount - doctorCount - sheriffCount;
  
  let roleIndex = 0;
  
  for (let i = 0; i < mafiaCount; i++) {
    players[roleIndex].role = ROLES.MAFIA;
    roleIndex++;
  }
  
  for (let i = 0; i < doctorCount; i++) {
    players[roleIndex].role = ROLES.DOCTOR;
    roleIndex++;
  }
  
  for (let i = 0; i < sheriffCount; i++) {
    players[roleIndex].role = ROLES.SHERIFF;
    roleIndex++;
  }
  
  for (let i = 0; i < civilianCount; i++) {
    players[roleIndex].role = ROLES.CIVILIAN;
    roleIndex++;
  }
  
  game.players = players;
}

function checkGameOver(gameId) {
  const game = games[gameId];
  
  const alivePlayers = game.players.filter(player => player.isAlive);
  const aliveMafia = alivePlayers.filter(player => player.role.team === 'mafia').length;
  const aliveTown = alivePlayers.filter(player => player.role.team === 'town').length;
  
  if (aliveMafia >= aliveTown) {
    game.winner = 'mafia';
    return true;
  }
  
  if (aliveMafia === 0) {
    game.winner = 'town';
    return true;
  }
  
  return false;
}

function getNextPhase(currentPhase, gameId) {
  switch (currentPhase) {
    case PHASES.LOBBY:
      return PHASES.NIGHT;
    case PHASES.NIGHT:
      return PHASES.DAY;
    case PHASES.DAY:
      return PHASES.VOTING;
    case PHASES.VOTING:
      if (checkGameOver(gameId)) {
        return PHASES.ENDED;
      }
      return PHASES.NIGHT;
    case PHASES.RESULTS:
      if (checkGameOver(gameId)) {
        return PHASES.ENDED;
      }
      return PHASES.NIGHT;
    default:
      return PHASES.LOBBY;
  }
}

function getPhaseDuration(phase) {
  switch (phase) {
    case PHASES.NIGHT:
      return 30; 
    case PHASES.DAY:
      return 120; 
    case PHASES.VOTING:
      return 30; 
    case PHASES.RESULTS:
      return 10; 
    default:
      return 0;
  }
}

function startTimer(gameId) {
  const game = games[gameId];
  if (!game) return;
  
  clearInterval(game.timer);
  
  game.timeLeft = getPhaseDuration(game.phase);
  game.timer = setInterval(() => {
    game.timeLeft--;
    
    io.to(gameId).emit('updateTimer', {
      timeLeft: game.timeLeft,
      phase: game.phase
    });
    
    if (game.timeLeft <= 0) {
      clearInterval(game.timer);
      progressGame(gameId);
    }
  }, 1000);
}

function processNightActions(gameId) {
  const game = games[gameId];
  game.lastKilled = null;
  
  let targetId = game.mafiaTarget;
  const protectedId = game.protectedPlayer;

  if (targetId && targetId !== protectedId) {
    const targetPlayer = game.players.find(p => p.id === targetId);
    if (targetPlayer) {
      targetPlayer.isAlive = false;
      game.lastKilled = targetPlayer;
    }
  }

  game.protectedPlayer = null;
  game.mafiaTarget = null;
  game.investigatedPlayer = null;
  game.actions = {};
}

function processVotes(gameId) {
  const game = games[gameId];
  
  const voteCount = {};
  
  game.players.forEach(player => {
    if (player.votedFor && player.isAlive) {
      voteCount[player.votedFor] = (voteCount[player.votedFor] || 0) + 1;
    }
  });
  
  let maxVotes = 0;
  let targetId = null;
  
  for (const [playerId, votes] of Object.entries(voteCount)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      targetId = playerId;
    }
  }
  
  const tiedPlayers = Object.entries(voteCount).filter(([_, votes]) => votes === maxVotes);
  
  if (tiedPlayers.length > 1 || maxVotes === 0) {
    game.lastKilled = null;
  } else if (targetId) {
    const targetPlayer = game.players.find(p => p.id === targetId);
    if (targetPlayer) {
      targetPlayer.isAlive = false;
      game.lastKilled = targetPlayer;
    }
  }
  
  game.players.forEach(player => {
    player.votedFor = null;
  });
}

function progressGame(gameId) {
  const game = games[gameId];
  if (!game) return;
  
  switch (game.phase) {
    case PHASES.NIGHT:
      processNightActions(gameId);
      break;
    case PHASES.VOTING:
      processVotes(gameId);
      break;
  }
  
  const nextPhase = getNextPhase(game.phase, gameId);
  game.phase = nextPhase;
  
  if (nextPhase === PHASES.DAY) {
    game.dayCount++;
  }
  
  const phaseDuration = getPhaseDuration(nextPhase);
  
  io.to(gameId).emit('phaseChange', {
    phase: game.phase,
    dayCount: game.dayCount,
    duration: phaseDuration,
    lastKilled: game.lastKilled,
    gameOver: game.phase === PHASES.ENDED,
    winner: game.winner
  });
  
  if (phaseDuration > 0) {
    startTimer(gameId);
  }
}

io.on('connection', (socket) => {
  let currentGameId = null;
  let player = null;

  socket.on('createGame', ({ username }) => {
    const gameId = createGame(socket.id, username);
    currentGameId = gameId;
    
    socket.join(gameId);
    
    player = {
      id: socket.id,
      name: username
    };
    
    socket.emit('gameCreated', {
      gameId,
      players: games[gameId].players,
      isHost: true
    });
  });

  socket.on('joinGame', ({ gameId, username }) => {
    const game = games[gameId];
    
    if (!game) {
      socket.emit('error', { message: 'Chat not found' });
      return;
    }
    
    if (game.started) {
      socket.emit('error', { message: 'Chat already started' });
      return;
    }
    
    socket.join(gameId);
    currentGameId = gameId;
    
    player = {
      id: socket.id,
      name: username,
      isAlive: true,
      role: null,
      votedFor: null
    };
    
    game.players.push(player);
    
    io.to(gameId).emit('playerJoined', {
      players: game.players,
      newPlayer: player
    });
    
    socket.emit('gameJoined', {
      gameId,
      players: game.players,
      isHost: game.host === socket.id
    });
  });

  socket.on('startGame', () => {
    const game = games[currentGameId];
    
    if (!game || game.host !== socket.id) {
      socket.emit('error', { message: 'Not authorized to start the game' });
      return;
    }
    
    if (game.players.length < 4) {
      socket.emit('error', { message: 'Need at least 4 players to start' });
      return;
    }
    
    assignRoles(currentGameId);
    
    game.started = true;
    game.phase = PHASES.NIGHT;
    game.dayCount = 1;

    game.players.forEach(player => {
      io.to(player.id).emit('gameStarted', {
        role: player.role,
        players: game.players.map(p => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive
        }))
      });
    });
    
    progressGame(currentGameId);
  });

  socket.on('sendMessage', ({ message }) => {
    const game = games[currentGameId];
    if (!game) return;
    
    const sender = game.players.find(p => p.id === socket.id);
    if (!sender) return;
    

    if (game.phase === PHASES.DAY || game.phase === PHASES.LOBBY) {
      io.to(currentGameId).emit('receiveMessage', {
        sender: sender.name,
        message,
        id: socket.id,
        isSystem: false
      });
    } else if (game.phase === PHASES.NIGHT && sender.role.team === 'mafia') {
      game.players.forEach(player => {
        if (player.role.team === 'mafia' && player.isAlive) {
          io.to(player.id).emit('receiveMessage', {
            sender: sender.name + ' (Mafia)',
            message,
            id: socket.id,
            isMafiaChat: true
          });
        }
      });
    }
  });

  socket.on('vote', ({ targetId }) => {
    const game = games[currentGameId];
    if (!game || game.phase !== PHASES.VOTING) return;
    
    const voter = game.players.find(p => p.id === socket.id);
    const target = game.players.find(p => p.id === targetId);
    
    if (!voter || !voter.isAlive || !target || !target.isAlive) return;
    
    voter.votedFor = targetId;
    
    io.to(currentGameId).emit('playerVoted', {
      voterId: socket.id,
      voterName: voter.name,
      targetId,
      targetName: target.name
    });
  });

  socket.on('nightAction', ({ targetId, action }) => {
    const game = games[currentGameId];
    if (!game || game.phase !== PHASES.NIGHT) return;
    
    const actor = game.players.find(p => p.id === socket.id);
    const target = game.players.find(p => p.id === targetId);
    
    if (!actor || !actor.isAlive || !target || !target.isAlive) return;
    
    switch (action) {
      case 'kill':
        if (actor.role.team === 'mafia') {
          game.mafiaTarget = targetId;
          game.actions[socket.id] = { action, targetId };
          
          game.players.forEach(player => {
            if (player.role.team === 'mafia' && player.isAlive && player.id !== socket.id) {
              io.to(player.id).emit('mafiaAction', {
                actorName: actor.name,
                targetName: target.name
              });
            }
          });
        }
        break;
      case 'protect':
        if (actor.role.name === 'Doctor') {
          game.protectedPlayer = targetId;
          game.actions[socket.id] = { action, targetId };
        }
        break;
      case 'investigate':
        if (actor.role.name === 'Sheriff') {
          game.investigatedPlayer = targetId;
          game.actions[socket.id] = { action, targetId };
          
          io.to(socket.id).emit('investigationResult', {
            targetName: target.name,
            isMafia: target.role.team === 'mafia'
          });
        }
        break;
    }
    
    socket.emit('actionConfirmed', { action, targetName: target.name });
  });

  socket.on('disconnect', () => {
    if (!currentGameId) return;
    
    const game = games[currentGameId];
    if (!game) return;
    
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      game.players.splice(playerIndex, 1);
      
      if (game.host === socket.id && game.players.length > 0) {
        game.host = game.players[0].id;
      }
      
      io.to(currentGameId).emit('playerLeft', {
        playerId: socket.id,
        players: game.players,
        newHost: game.host
      });
      
      if (game.started) {
        if (checkGameOver(currentGameId)) {
          game.phase = PHASES.ENDED;
          
          io.to(currentGameId).emit('gameOver', {
            winner: game.winner,
            players: game.players
          });
          
          clearInterval(game.timer);
        }
      }
      
      if (game.players.length === 0) {
        clearInterval(game.timer);
        delete games[currentGameId];
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
