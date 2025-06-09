import { PHASES, getPhaseDuration } from '../models/game.js';
import { 
  getGames, 
  createGame, 
  assignRoles, 
  checkGameOver, 
  getNextPhase, 
  processNightActions, 
  processVotes 
} from '../controllers/gameController.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let io;
const games = getGames();

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

async function progressGame(gameId) {
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
  const killedSocket = await io.in(game?.lastKilled?.id).fetchSockets();
  console.log(killedSocket)
  
  if (killedSocket[0]) {
    killedSocket[0].emit('youDied', {
      message: "Unfortunately, you've have died and the game is over for you!",
      playerId: game.lastKilled.id
    });

    killedSocket[0].leave(gameId);

    io.to(gameId).emit('votedOut', {
      sender: 'System',
      message: `${game.lastKilled.name} was killed.`,
      id: `system-${Date.now()}`,
      playerId: game.lastKilled.id
    });
  }
  
  if (phaseDuration > 0) {
    startTimer(gameId);
  }
}

function initialize(socketIo) {
  io = socketIo;
  
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

    socket.on('joinGame', async ({ gameId, username }) => {
      const game = games[gameId];
      
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      if (game.started) {
        socket.emit('error', { message: 'Game already started' });
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

      const messages = await prisma.message.findMany({
        where: {
          gameId: gameId
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      console.log(messages)

      const transformedMessages = messages.map(msg => {
          return {
            id: msg.senderId,
            sender: msg.senderName,
            message: msg.content,
            isSystem: msg.senderName === "System",
          };
      });
      
      io.to(gameId).emit('playerJoined', {
        players: game.players,
        newPlayer: player,
      });
      
      socket.emit('gameJoined', {
        gameId,
        players: game.players,
        isHost: game.host === socket.id,
        messages: transformedMessages
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

    socket.on('sendMessage', async ({ message, id}) => {
      const game = getGames()[id]
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

         await prisma.message.create({
          data: {
            content: message,
            senderName: sender.name,
            senderId: sender.id,
            gameId: game.id,
            messageType: "PUBLIC",
            phase: game.phase,
            dayCount: game.dayCount
          }
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
}

export default {
  initialize,
  startTimer,
  progressGame
};