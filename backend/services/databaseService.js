import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ініціалізація підключення до БД
export async function initializeDatabase() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Закриття підключення до БД
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

// Створення нової гри
export async function createGameInDB(gameId, hostId, hostName) {
  try {
    const game = await prisma.game.create({
      data: {
        gameId,
        hostId,
        hostName,
        players: {
          create: {
            playerId: hostId,
            name: hostName
          }
        }
      },
      include: {
        players: true
      }
    });
    return game;
  } catch (error) {
    console.error('Error creating game in database:', error);
    throw error;
  }
}

// Додавання гравця до гри
export async function addPlayerToDB(gameId, playerId, playerName) {
  try {
    const game = await prisma.game.findUnique({
      where: { gameId }
    });
    
    if (!game) {
      throw new Error('Game not found');
    }

    const player = await prisma.player.create({
      data: {
        playerId,
        name: playerName,
        gameId: game.id
      }
    });
    
    return player;
  } catch (error) {
    console.error('Error adding player to database:', error);
    throw error;
  }
}

// Оновлення статусу гри
export async function updateGameStatus(gameId, updates) {
  try {
    const game = await prisma.game.update({
      where: { gameId },
      data: updates
    });
    return game;
  } catch (error) {
    console.error('Error updating game status:', error);
    throw error;
  }
}

// Оновлення статусу гравця
export async function updatePlayerStatus(playerId, updates) {
  try {
    const player = await prisma.player.update({
      where: { playerId },
      data: updates
    });
    return player;
  } catch (error) {
    console.error('Error updating player status:', error);
    throw error;
  }
}

// Збереження повідомлення
export async function saveMessage(messageData) {
  try {
    const { content, senderName, senderId, gameId, messageType = 'PUBLIC', phase, dayCount } = messageData;
    
    const game = await prisma.game.findUnique({
      where: { gameId }
    });
    
    if (!game) {
      throw new Error('Game not found');
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderName,
        senderId,
        gameId: game.id,
        messageType,
        phase,
        dayCount
      }
    });
    
    return message;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

// Отримання повідомлень гри
export async function getGameMessages(gameId, messageType = null) {
  try {
    const game = await prisma.game.findUnique({
      where: { gameId }
    });
    
    if (!game) {
      throw new Error('Game not found');
    }

    const whereClause = {
      gameId: game.id
    };
    
    if (messageType) {
      whereClause.messageType = messageType;
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        player: {
          select: {
            name: true,
            playerId: true
          }
        }
      }
    });
    
    return messages;
  } catch (error) {
    console.error('Error getting game messages:', error);
    throw error;
  }
}

// Отримання гри з гравцями
export async function getGameWithPlayers(gameId) {
  try {
    const game = await prisma.game.findUnique({
      where: { gameId },
      include: {
        players: true,
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
    
    return game;
  } catch (error) {
    console.error('Error getting game with players:', error);
    throw error;
  }
}

// Видалення гравця з гри
export async function removePlayerFromDB(playerId) {
  try {
    await prisma.player.delete({
      where: { playerId }
    });
  } catch (error) {
    console.error('Error removing player from database:', error);
    throw error;
  }
}

// Видалення гри
export async function deleteGameFromDB(gameId) {
  try {
    await prisma.game.delete({
      where: { gameId }
    });
  } catch (error) {
    console.error('Error deleting game from database:', error);
    throw error;
  }
}

// Отримання статистики гравця
export async function getPlayerStats(playerId) {
  try {
    const stats = await prisma.player.findMany({
      where: { playerId },
      include: {
        game: {
          select: {
            winner: true,
            endedAt: true,
            createdAt: true
          }
        }
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting player stats:', error);
    throw error;
  }
}

export { prisma };
export default {
  initializeDatabase,
  disconnectDatabase,
  createGameInDB,
  addPlayerToDB,
  updateGameStatus,
  updatePlayerStatus,
  saveMessage,
  getGameMessages,
  getGameWithPlayers,
  removePlayerFromDB,
  deleteGameFromDB,
  getPlayerStats,
  prisma
};