import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

const app = express();

app.use(express.json());

const apiRouter = express.Router();


apiRouter.use('/api/auth', authRoutes);
apiRouter.use('/api/users', userRoutes);

app.use('/api', apiRouter);

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['https://sent-message-client.onrender.com'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});


const games = {};

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
      socket.emit('error', { message: 'Чат не знайдено' });
      return;
    }
    
    if (game.started) {
      socket.emit('error', { message: 'Чат не знайдено' });
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
