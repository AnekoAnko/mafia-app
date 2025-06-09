import express from 'express';
import { createServer } from 'http';
import socketService from './services/socketService.js';
import { Server } from 'socket.io'

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

socketService.initialize(io);

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});