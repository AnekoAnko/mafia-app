import { v4 as uuidv4 } from 'uuid';
import { ROLES, PHASES, getPhaseDuration } from '../models/game.js';

const games = {};

export function getGames() {
  return games;
}

export function createGame(hostId, hostName) {
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

export function assignRoles(gameId) {
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

export function checkGameOver(gameId) {
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