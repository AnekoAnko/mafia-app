import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

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

// In-memory cache for active games to store temporary data
const gameCache = new Map();

function getGameCache(gameId) {
  if (!gameCache.has(gameId)) {
    gameCache.set(gameId, {
      timer: null,
      timeLeft: 0,
      actions: {},
      votes: {},
      mafiaTarget: null,
      protectedPlayer: null,
      investigatedPlayer: null,
      lastKilled: null
    });
  }
  return gameCache.get(gameId);
}

function generateGameId() {
  return uuidv4().substring(0, 6).toUpperCase();
}

async function createGame(hostId, hostName) {
  try {
    const gameId = generateGameId();
    console.log(gameId)
    
    const game = await prisma.game.create({
      data: {
        gameId,
        hostId,
        hostName,
        phase: PHASES.LOBBY,
        started: false,
        dayCount: 0
      }
    });
    
    const player = await prisma.player.create({
      data: {
        playerId: hostId,
        name: hostName,
        gameId: game.id,
        isAlive: true
      }
    });
    
    return { gameId, game, player };
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
}

async function assignRoles(gameId) {
  try {
    const game = await prisma.game.findUnique({
      where: { gameId },
      include: { players: true }
    });
    
    if (!game) throw new Error('Game not found');
    
    const players = [...game.players];
    
    // Shuffle players
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
    const roleAssignments = [];
    
    // Assign Mafia roles
    for (let i = 0; i < mafiaCount; i++) {
      roleAssignments.push({
        playerId: players[roleIndex].playerId,
        role: JSON.stringify(ROLES.MAFIA)
      });
      roleIndex++;
    }
    
    // Assign Doctor role
    for (let i = 0; i < doctorCount; i++) {
      roleAssignments.push({
        playerId: players[roleIndex].playerId,
        role: JSON.stringify(ROLES.DOCTOR)
      });
      roleIndex++;
    }
    
    // Assign Sheriff role
    for (let i = 0; i < sheriffCount; i++) {
      roleAssignments.push({
        playerId: players[roleIndex].playerId,
        role: JSON.stringify(ROLES.SHERIFF)
      });
      roleIndex++;
    }
    
    // Assign Civilian roles
    for (let i = 0; i < civilianCount; i++) {
      roleAssignments.push({
        playerId: players[roleIndex].playerId,
        role: JSON.stringify(ROLES.CIVILIAN)
      });
      roleIndex++;
    }
    
    // Update players with roles in database
    for (const assignment of roleAssignments) {
      await prisma.player.update({
        where: { playerId: assignment.playerId },
        data: { role: assignment.role }
      });
    }
    
    return await prisma.player.findMany({
      where: { gameId: game.id }
    });
  } catch (error) {
    console.error('Error assigning roles:', error);
    throw error;
  }
}

async function checkGameOver(gameId) {
  try {
    const game = await prisma.game.findUnique({
      where: { gameId },
      include: { players: true }
    });
    
    if (!game) return false;
    
    const alivePlayers = game.players.filter(player => player.isAlive);
    const aliveMafia = alivePlayers.filter(player => {
      if (!player.role) return false;
      const role = JSON.parse(player.role);
      return role.team === 'mafia';
    }).length;
    
    const aliveTown = alivePlayers.filter(player => {
      if (!player.role) return false;
      const role = JSON.parse(player.role);
      return role.team === 'town';
    }).length;
    
    let winner = null;
    let gameOver = false;
    
    if (aliveMafia >= aliveTown) {
      winner = 'mafia';
      gameOver = true;
    } else if (aliveMafia === 0) {
      winner = 'town';
      gameOver = true;
    }
    
    if (gameOver) {
      await prisma.game.update({
        where: { gameId },
        data: { 
          winner,
          phase: PHASES.ENDED
        }
      });
    }
    
    return { gameOver, winner };
  } catch (error) {
    console.error('Error checking game over:', error);
    return { gameOver: false, winner: null };
  }
}

function getNextPhase(currentPhase, gameOver) {
  if (gameOver) return PHASES.ENDED;
  
  switch (currentPhase) {
    case PHASES.LOBBY:
      return PHASES.NIGHT;
    case PHASES.NIGHT:
      return PHASES.DAY;
    case PHASES.DAY:
      return PHASES.VOTING;
    case PHASES.VOTING:
      return PHASES.NIGHT;
    case PHASES.RESULTS:
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
  const cache = getGameCache(gameId);
  
  clearInterval(cache.timer);
  
  cache.timer = setInterval(() => {
    cache.timeLeft--;
    
    io.to(gameId).emit('updateTimer', {
      timeLeft: cache.timeLeft,
      phase: cache.phase
    });
    
    if (cache.timeLeft <= 0) {
      clearInterval(cache.timer);
      progressGame(gameId);
    }
  }, 1000);
}

async function processNightActions(gameId) {
  try {
    const cache = getGameCache(gameId);
    cache.lastKilled = null;
    
    const targetId = cache.mafiaTarget;
    const protectedId = cache.protectedPlayer;

    if (targetId && targetId !== protectedId) {
      await prisma.player.update({
        where: { playerId: targetId },
        data: { isAlive: false }
      });
      
      const targetPlayer = await prisma.player.findUnique({
        where: { playerId: targetId }
      });
      
      cache.lastKilled = targetPlayer;
    }

    // Reset night actions
    cache.protectedPlayer = null;
    cache.mafiaTarget = null;
    cache.investigatedPlayer = null;
    cache.actions = {};
  } catch (error) {
    console.error('Error processing night actions:', error);
  }
}

async function processVotes(gameId) {
  try {
    const cache = getGameCache(gameId);
    const voteCount = {};
    
    // Count votes from cache
    Object.values(cache.votes || {}).forEach(targetId => {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
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
      cache.lastKilled = null;
    } else if (targetId) {
      await prisma.player.update({
        where: { playerId: targetId },
        data: { isAlive: false }
      });
      
      const targetPlayer = await prisma.player.findUnique({
        where: { playerId: targetId }
      });
      
      cache.lastKilled = targetPlayer;
    }
    
    // Clear votes
    cache.votes = {};
  } catch (error) {
    console.error('Error processing votes:', error);
  }
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
        await processNightActions(gameId);
        break;
      case PHASES.VOTING:
        await processVotes(gameId);
        break;
    }
    
    const gameOverResult = await checkGameOver(gameId);
    const nextPhase = getNextPhase(game.phase, gameOverResult.gameOver);
    
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
      gameOver: gameOverResult.gameOver,
      winner: gameOverResult.winner
    });
    
    if (phaseDuration > 0) {
      startTimer(gameId);
    }
  } catch (error) {
    console.error('Error progressing game:', error);
  }
}

io.on('connection', (socket) => {
  let currentGameId = null;
  let currentPlayer = null;

  socket.on('createGame', async ({ username }) => {
    try {
      const { gameId, game, player } = await createGame(socket.id, username);
      currentGameId = gameId;
      currentPlayer = player;
      console.log(currentGameId, 'ss')
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
          gameId: game.id,
          isAlive: true
        }
      });
      
      socket.join(gameId);
      currentGameId = gameId;
      currentPlayer = player;

      console.log("GAME ID", game.id)
      
      const allPlayers = await prisma.player.findMany({
        where: { gameId: game.id }
      });
      
      const playerData = allPlayers.map(p => ({
        id: p.playerId,
        name: p.name,
        isAlive: p.isAlive
      }));
      
      // Get message history for the game
      const messages = await prisma.message.findMany({
        where: { gameId: game.id },
        orderBy: { createdAt: 'asc' }
      });

      console.log(messages)
      
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
        isHost: game.hostId === socket.id,
        messages: messages.map(msg => ({
          sender: msg.messageType === 'MAFIA' ? msg.senderName + ' (Mafia)' : msg.senderName,
          message: msg.content,
          id: msg.senderId,
          isMafiaChat: msg.messageType === 'MAFIA',
          phase: msg.phase,
          dayCount: msg.dayCount,
          timestamp: msg.createdAt
        }))
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
      
      const playersWithRoles = await assignRoles(currentGameId);
      
      await prisma.game.update({
        where: { gameId: currentGameId },
        data: {
          started: true,
          phase: PHASES.NIGHT,
          dayCount: 1
        }
      });

      // Initialize cache for the game
      const cache = getGameCache(currentGameId);
      cache.timeLeft = getPhaseDuration(PHASES.NIGHT);
      
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

  // Reconnect to existing game
  socket.on('reconnectToGame', async ({ gameId, playerId }) => {
    try {
      const game = await prisma.game.findUnique({
        where: { gameId },
        include: { players: true }
      });
      
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      const player = game.players.find(p => p.playerId === playerId);
      if (!player) {
        socket.emit('error', { message: 'Player not found in this game' });
        return;
      }
      
      // Update player's socket ID
      await prisma.player.update({
        where: { playerId: playerId },
        data: { playerId: socket.id }
      });
      
      socket.join(gameId);
      currentGameId = gameId;
      currentPlayer = player;
      
      const allPlayers = await prisma.player.findMany({
        where: { gameId: game.id }
      });
      
      const playerData = allPlayers.map(p => ({
        id: p.playerId === playerId ? socket.id : p.playerId,
        name: p.name,
        isAlive: p.isAlive
      }));
      
      // Get message history
      const messages = await prisma.message.findMany({
        where: { gameId: game.id },
        orderBy: { createdAt: 'asc' }
      });
      
      // Filter messages based on player role
      const visibleMessages = messages.filter(msg => {
        if (msg.messageType === 'PUBLIC') return true;
        
        if (msg.messageType === 'MAFIA' && player.role) {
          const playerRole = JSON.parse(player.role);
          return playerRole.team === 'mafia';
        }
        
        return false;
      });
      
      socket.emit('gameReconnected', {
        gameId,
        players: playerData,
        isHost: game.hostId === playerId,
        gameState: {
          phase: game.phase,
          dayCount: game.dayCount,
          started: game.started,
          winner: game.winner
        },
        playerRole: player.role ? JSON.parse(player.role) : null,
        messages: visibleMessages.map(msg => ({
          sender: msg.messageType === 'MAFIA' ? msg.senderName + ' (Mafia)' : msg.senderName,
          message: msg.content,
          id: msg.senderId,
          isMafiaChat: msg.messageType === 'MAFIA',
          phase: msg.phase,
          dayCount: msg.dayCount,
          timestamp: msg.createdAt
        }))
      });
      
      // Notify other players about reconnection
      socket.to(gameId).emit('playerReconnected', {
        playerId: socket.id,
        playerName: player.name,
        oldPlayerId: playerId
      });
      
    } catch (error) {
      console.error('Error reconnecting to game:', error);
      socket.emit('error', { message: 'Failed to reconnect to game' });
    }
  });

  // New event for getting message history
  socket.on('getMessageHistory', async ({ gameId }) => {
    try {
      console.log("OKI")
      const game = await prisma.game.findUnique({
        where: { gameId },
        include: { players: true }
      });
      
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      const player = game.players.find(p => p.playerId === socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not in this game' });
        return;
      }
      
      const messages = await prisma.message.findMany({
        where: { gameId: game.id },
        orderBy: { createdAt: 'asc' }
      });
      
      // Filter messages based on player role and message visibility rules
      const visibleMessages = messages.filter(msg => {
        // Public messages are visible to everyone
        if (msg.messageType === 'PUBLIC') return true;
        
        // Mafia messages are only visible to mafia members
        if (msg.messageType === 'MAFIA' && player.role) {
          const playerRole = JSON.parse(player.role);
          return playerRole.team === 'mafia';
        }
        
        return false;
      });
      
      socket.emit('messageHistory', {
        messages: visibleMessages.map(msg => ({
          sender: msg.messageType === 'MAFIA' ? msg.senderName + ' (Mafia)' : msg.senderName,
          message: msg.content,
          id: msg.senderId,
          isMafiaChat: msg.messageType === 'MAFIA',
          phase: msg.phase,
          dayCount: msg.dayCount,
          timestamp: msg.createdAt
        }))
      });
    } catch (error) {
      console.error('Error getting message history:', error);
      socket.emit('error', { message: 'Failed to get message history' });
    }
  });

  socket.on('sendMessage', async ({ message }) => {
    try {
      console.log(currentGameId)
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
      
      // Store vote in cache
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
      
      const player = game.players.find(p => p.playerId === socket.id);
      if (!player) return;
      
      // Remove player from database
      await prisma.player.delete({
        where: { playerId: socket.id }
      });
      
      const updatedPlayers = await prisma.player.findMany({
        where: { gameId: game.id }
      });
      
      // If host disconnected, assign new host
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
      
      // Check if game should end
      if (game.started) {
        const gameOverResult = await checkGameOver(currentGameId);
        if (gameOverResult.gameOver) {
          io.to(currentGameId).emit('gameOver', {
            winner: gameOverResult.winner,
            players: updatedPlayers
          });
          
          const cache = getGameCache(currentGameId);
          clearInterval(cache.timer);
        }
      }
      
      // If no players left, clean up
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});