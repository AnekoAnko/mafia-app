import { v4 as uuidv4 } from 'uuid';
import { ROLES, PHASES, getPhaseDuration } from '../models/game.js';

const games = {};

export function getGames() {
  return games;
}

export async function createGame(hostId, hostName) {
  const gameId = uuidv4().substring(0, 6).toUpperCase();

  const game = await prisma.game.create({
    data: {
      id: gameId,
      hostId,
      hostName,
      players: {
        create: {
          playerId: hostId,
          name: hostName,
        },
      },
    },
    include: {
      players: true,
    },
  });

  return game;
}

export async function assignRoles(gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) throw new Error('Game not found');

  const players = [...game.players];
  // Перемішування гравців
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  const playerCount = players.length;
  const mafiaCount = Math.max(Math.floor(playerCount / 4), 1);
  const doctorCount = 1;
  const sheriffCount = 1;
  const civilianCount = playerCount - mafiaCount - doctorCount - sheriffCount;

  let roleIndex = 0;

  for (let i = 0; i < mafiaCount; i++) {
    players[roleIndex].role = 'mafia';
    roleIndex++;
  }

  for (let i = 0; i < doctorCount; i++) {
    players[roleIndex].role = 'doctor';
    roleIndex++;
  }

  for (let i = 0; i < sheriffCount; i++) {
    players[roleIndex].role = 'sheriff';
    roleIndex++;
  }

  for (let i = 0; i < civilianCount; i++) {
    players[roleIndex].role = 'civilian';
    roleIndex++;
  }

  // Оновлення ролей у базі даних
  for (const player of players) {
    await prisma.player.update({
      where: { id: player.id },
      data: { role: player.role },
    });
  }

  return players;
}

export async function checkGameOver(gameId) {
  const players = await prisma.player.findMany({
    where: {
      gameId,
      isAlive: true,
    },
  });

  const aliveMafia = players.filter(p => p.role === 'mafia').length;
  const aliveTown = players.length - aliveMafia;

  if (aliveMafia >= aliveTown) {
    await prisma.game.update({
      where: { id: gameId },
      data: { winner: 'mafia' },
    });
    return true;
  }

  if (aliveMafia === 0) {
    await prisma.game.update({
      where: { id: gameId },
      data: { winner: 'town' },
    });
    return true;
  }

  return false;
}


export function getNextPhase(currentPhase, gameId) {
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

export function processNightActions(gameId) {
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

export function processVotes(gameId) {
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