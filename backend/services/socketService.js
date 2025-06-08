import { PrismaClient } from '@prisma/client';
import { PHASES, getPhaseDuration } from '../models/game.js';
import { 
  assignRoles, 
  checkGameOver, 
  getNextPhase, 
  processNightActions, 
  processVotes 
} from '../controllers/gameController.js';

const prisma = new PrismaClient();
let io;

// In-memory cache for active games to store temporary data
const gameCache = new Map();

function getGameCache(gameId) {
  if (!gameCache.has(gameId)) {
    gameCache.set(gameId, {
      timer: null,
      timeLeft: 0,
      actions: {},
      mafiaTarget: null,
      protectedPlayer: null,
      investigatedPlayer: null,
      lastKilled: null
    });
  }
  return gameCache.get(gameId);
}

function startTimer(gameId) {
  const cache = getGameCache(gameId);
  
  clearInterval(cache.timer);
  
  cache.timeLeft = getPhaseDuration(PHASES.DAY); // Default phase duration
  cache.timer = setInterval(() => {
    cache.timeLeft--;
    
    io.to(gameId).emit('updateTimer', {
      timeLeft: cache.timeLeft,
      phase: cache.phase || PHASES.DAY
    });
    
    if (cache.timeLeft <= 0) {
      clearInterval(cache.timer);
      progressGame(gameId);
    }
  }, 1000);
}

async function progressGame(gameId) {
  try {
    const game = await prisma.game.findUnique({
      where: { gameId },
      include: { players: true }
    });
    
    if (!game) return;
    
    const cache = getGameCache(gameId);
    
    switch (game.phase) {
      case PHASES.NIGHT:
        await processNightActions(gameId, cache);
        break;
      case PHASES.VOTING:
        await processVotes(gameId, cache);
        break;
    }
    
    const nextPhase = getNextPhase(game.phase, gameId);
    let updateData = { phase: nextPhase };
    
    if (nextPhase === PHASES.DAY) {
      updateData.dayCount = game.dayCount + 1;
    }
    
    await prisma.game.update({
      where: { gameId },
      data: updateData
    });
    
    const phaseDuration = getPhaseDuration(nextPhase);
    cache.timeLeft = phaseDuration;
    
    io.to(gameId).emit('phaseChange', {
      phase: nextPhase,
      dayCount: updateData.dayCount || game.dayCount,
      duration: phaseDuration,
      lastKilled: cache.lastKilled,
      gameOver: nextPhase === PHASES.ENDED,
      winner: game.winner
    });
    
    if (phaseDuration > 0) {
      startTimer(gameId);
    }
  } catch (error) {
    console.error('Error progressing game:', error);
  }
}

function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function initialize(socketIo) {
  io = socketIo;
  
  io.on('connection', (socket) => {
    let currentGameId = null;
    let currentPlayer = null;

    socket.on('createGame', async ({ username }) => {
      try {
        const gameId = generateGameId();
        
        const game = await prisma.game.create({
          data: {
            gameId,
            hostId: socket.id,
            hostName: username,
            phase: PHASES.LOBBY
          }
        });
        
        const player = await prisma.player.create({
          data: {
            playerId: socket.id,
            name: username,
            gameId: game.id
          }
        });
        
        currentGameId = gameId;
        currentPlayer = player;
        
        socket.join(gameId);
        
        const players = await prisma.player.findMany({
          where: { gameId: game.id }
        });
        
        socket.emit('gameCreated', {
          gameId,
          players: players.map(p => ({
            id: p.playerId,
            name: p.name,
            isAlive: p.isAlive
          })),
          isHost: true
        });
      } catch (error) {
        console.error('Error creating game:', error);
        socket.emit('error', { message: 'Failed to create game' });
      }
    });

    socket.on('joinGame', async ({ gameId, username }) => {
      try {
        const game = await prisma.game.findUnique({
          where: { gameId },
          include: { players: true }
        });
        
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }
        
        if (game.started) {
          socket.emit('error', { message: 'Game already started' });
          return;
        }
        
        const player = await prisma.player.create({
          data: {
            playerId: socket.id,
            name: username,
            gameId: game.id
          }
        });
        
        socket.join(gameId);
        currentGameId = gameId;
        currentPlayer = player;
        
        const allPlayers = await prisma.player.findMany({
          where: { gameId: game.id }
        });
        
        const playerData = allPlayers.map(p => ({
          id: p.playerId,
          name: p.name,
          isAlive: p.isAlive
        }));
        
        io.to(gameId).emit('playerJoined', {
          players: playerData,
          newPlayer: {
            id: player.playerId,
            name: player.name,
            isAlive: player.isAlive
          }
        });
        
        socket.emit('gameJoined', {
          gameId,
          players: playerData,
          isHost: game.hostId === socket.id
        });
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    socket.on('startGame', async () => {
      try {
        const game = await prisma.game.findUnique({
          where: { gameId: currentGameId },
          include: { players: true }
        });
        
        if (!game || game.hostId !== socket.id) {
          socket.emit('error', { message: 'Not authorized to start the game' });
          return;
        }
        
        if (game.players.length < 4) {
          socket.emit('error', { message: 'Need at least 4 players to start' });
          return;
        }
        
        // Assign roles and update players
        const playersWithRoles = await assignRoles(game.id);
        
        await prisma.game.update({
          where: { id: game.id },
          data: {
            started: true,
            phase: PHASES.NIGHT,
            dayCount: 1
          }
        });
        
        // Send role information to each player
        for (const player of playersWithRoles) {
          io.to(player.playerId).emit('gameStarted', {
            role: JSON.parse(player.role),
            players: playersWithRoles.map(p => ({
              id: p.playerId,
              name: p.name,
              isAlive: p.isAlive
            }))
          });
        }
        
        progressGame(currentGameId);
      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    socket.on('sendMessage', async ({ message }) => {
      try {
        const game = await prisma.game.findUnique({
          where: { gameId: currentGameId },
          include: { players: true }
        });
        
        if (!game) return;
        
        const sender = game.players.find(p => p.playerId === socket.id);
        if (!sender) return;
        
        let messageType = 'PUBLIC';
        let recipients = [];
        
        if (game.phase === PHASES.DAY || game.phase === PHASES.LOBBY) {
          messageType = 'PUBLIC';
          recipients = game.players.map(p => p.playerId);
        } else if (game.phase === PHASES.NIGHT && sender.role) {
          const role = JSON.parse(sender.role);
          if (role.team === 'mafia') {
            messageType = 'MAFIA';
            recipients = game.players
              .filter(p => p.role && JSON.parse(p.role).team === 'mafia' && p.isAlive)
              .map(p => p.playerId);
          }
        }

        console.log("CALL")
        
        if (recipients.length > 0) {
          // Save message to database
          await prisma.message.create({
            data: {
              content: message,
              senderName: sender.name,
              senderId: sender.playerId,
              gameId: game.id,
              messageType,
              phase: game.phase,
              dayCount: game.dayCount
            }
          });
          
          // Send to recipients
          recipients.forEach(playerId => {
            io.to(playerId).emit('receiveMessage', {
              sender: messageType === 'MAFIA' ? sender.name + ' (Mafia)' : sender.name,
              message,
              id: socket.id,
              isMafiaChat: messageType === 'MAFIA'
            });
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    socket.on('vote', async ({ targetId }) => {
      try {
        const game = await prisma.game.findUnique({
          where: { gameId: currentGameId },
          include: { players: true }
        });
        
        if (!game || game.phase !== PHASES.VOTING) return;
        
        const voter = game.players.find(p => p.playerId === socket.id);
        const target = game.players.find(p => p.playerId === targetId);
        
        if (!voter || !voter.isAlive || !target || !target.isAlive) return;
        
        // Store vote in cache (votes are temporary during voting phase)
        const cache = getGameCache(currentGameId);
        if (!cache.votes) cache.votes = {};
        cache.votes[socket.id] = targetId;
        
        io.to(currentGameId).emit('playerVoted', {
          voterId: socket.id,
          voterName: voter.name,
          targetId,
          targetName: target.name
        });
      } catch (error) {
        console.error('Error processing vote:', error);
      }
    });

    socket.on('nightAction', async ({ targetId, action }) => {
      try {
        const game = await prisma.game.findUnique({
          where: { gameId: currentGameId },
          include: { players: true }
        });
        
        if (!game || game.phase !== PHASES.NIGHT) return;
        
        const actor = game.players.find(p => p.playerId === socket.id);
        const target = game.players.find(p => p.playerId === targetId);
        
        if (!actor || !actor.isAlive || !target || !target.isAlive) return;
        
        const cache = getGameCache(currentGameId);
        const actorRole = JSON.parse(actor.role);
        
        switch (action) {
          case 'kill':
            if (actorRole.team === 'mafia') {
              cache.mafiaTarget = targetId;
              cache.actions[socket.id] = { action, targetId };
              
              // Notify other mafia members
              const mafiaPlayers = game.players.filter(p => 
                p.role && JSON.parse(p.role).team === 'mafia' && 
                p.isAlive && p.playerId !== socket.id
              );
              
              mafiaPlayers.forEach(player => {
                io.to(player.playerId).emit('mafiaAction', {
                  actorName: actor.name,
                  targetName: target.name
                });
              });
            }
            break;
          case 'protect':
            if (actorRole.name === 'Doctor') {
              cache.protectedPlayer = targetId;
              cache.actions[socket.id] = { action, targetId };
            }
            break;
          case 'investigate':
            if (actorRole.name === 'Sheriff') {
              cache.investigatedPlayer = targetId;
              cache.actions[socket.id] = { action, targetId };
              
              const targetRole = JSON.parse(target.role);
              io.to(socket.id).emit('investigationResult', {
                targetName: target.name,
                isMafia: targetRole.team === 'mafia'
              });
            }
            break;
        }
        
        socket.emit('actionConfirmed', { action, targetName: target.name });
      } catch (error) {
        console.error('Error processing night action:', error);
      }
    });

    socket.on('disconnect', async () => {
  if (!currentGameId) return;

  try {
    const game = await prisma.game.findUnique({
      where: { gameId: currentGameId },
      include: { players: true }
    });

    if (!game) return;

    // Знайти гравця, який відключився
    const player = game.players.find(p => p.playerId === socket.id);
    if (!player) return;

    // Вилучити гравця з бази
    await prisma.player.delete({
      where: { playerId: socket.id }
    });

    // Оновити список гравців після видалення
    const updatedPlayers = await prisma.player.findMany({
      where: { gameId: game.id }
    });

    // Якщо відключився хост, передати хостство наступному гравцю (якщо є)
    let newHostId = game.hostId;
    if (game.hostId === socket.id && updatedPlayers.length > 0) {
      newHostId = updatedPlayers[0].playerId;
      await prisma.game.update({
        where: { gameId: currentGameId },
        data: { hostId: newHostId }
      });
    }

    io.to(currentGameId).emit('playerLeft', {
      playerId: socket.id,
      players: updatedPlayers.map(p => ({
        id: p.playerId,
        name: p.name,
        isAlive: p.isAlive
      })),
      newHost: newHostId
    });

    // Перевірка на кінець гри (реалізуй у контролері)
    if (game.started && await checkGameOver(currentGameId)) {
      await prisma.game.update({
        where: { gameId: currentGameId },
        data: { phase: PHASES.ENDED }
      });

      io.to(currentGameId).emit('gameOver', {
        winner: game.winner,
        players: updatedPlayers
      });

      const cache = getGameCache(currentGameId);
      clearInterval(cache.timer);
    }

    // Якщо нікого не залишилось — видалити гру з кеша і з БД
    if (updatedPlayers.length === 0) {
      const cache = getGameCache(currentGameId);
      clearInterval(cache.timer);
      gameCache.delete(currentGameId);

      await prisma.game.delete({
        where: { gameId: currentGameId }
      });
      console.log(`Game ${currentGameId} deleted from DB due to no players.`);
    }
  } catch (error) {
    console.error('Error during disconnect cleanup:', error);
  }
});

  });
}

export default {
  initialize,
  startTimer,
  progressGame
};