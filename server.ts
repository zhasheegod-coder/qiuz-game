import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;

// Game State
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  ready: boolean;
  lastAnswerCorrect?: boolean;
  lastAnswerIndex?: number;
  level?: number;
  totalWins?: number;
}

// Mock Global Leaderboard Data
const GLOBAL_LEADERBOARD = [
  { name: "QuizMaster", score: 15420, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=QuizMaster", level: 42 },
  { name: "NeonKing", score: 12300, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=NeonKing", level: 38 },
  { name: "TriviaQueen", score: 11200, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=TriviaQueen", level: 35 },
  { name: "SmartyPants", score: 9800, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SmartyPants", level: 30 },
  { name: "Brainiac", score: 8500, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Brainiac", level: 28 },
];

interface Question {
  category: {
    en: string;
    zh: string;
    ar: string;
  };
  question: {
    en: string;
    zh: string;
    ar: string;
  };
  options: {
    en: string[];
    zh: string[];
    ar: string[];
  };
  answer: number;
}

interface Room {
  id: string;
  status: 'waiting' | 'starting' | 'playing' | 'answer_result' | 'result';
  players: Player[];
  currentQuestionIndex: number;
  timer: number;
  questions: Question[];
  gameInterval: NodeJS.Timeout | null;
}

const rooms = new Map<string, Room>();

const QUESTIONS: Question[] = [
  {
    category: { en: "Science", zh: "科学", ar: "علوم" },
    question: {
      en: "Which planet is known as the Red Planet?",
      zh: "哪颗行星被称为红色星球？",
      ar: "أي كوكب يعرف بالكوكب الأحمر؟"
    },
    options: {
      en: ["Earth", "Mars", "Jupiter", "Saturn"],
      zh: ["地球", "火星", "木星", "土星"],
      ar: ["الأرض", "المريخ", "المشتري", "زحل"]
    },
    answer: 1,
  },
  {
    category: { en: "Geography", zh: "地理", ar: "جغرافيا" },
    question: {
      en: "What is the capital of France?",
      zh: "法国的首都是哪里？",
      ar: "ما هي عاصمة فرنسا？"
    },
    options: {
      en: ["London", "Berlin", "Paris", "Madrid"],
      zh: ["伦敦", "柏林", "巴黎", "马德里"],
      ar: ["لندن", "برلين", "باريس", "مدريد"]
    },
    answer: 2,
  },
  {
    category: { en: "Science", zh: "科学", ar: "علوم" },
    question: {
      en: "Which element has the chemical symbol 'O'?",
      zh: "哪个元素的化学符号是 'O'？",
      ar: "أي عنصر له الرمز الكيميائي 'O'؟"
    },
    options: {
      en: ["Gold", "Silver", "Oxygen", "Iron"],
      zh: ["金", "银", "氧", "铁"],
      ar: ["ذهب", "فضة", "أكسجين", "حديد"]
    },
    answer: 2,
  },
  {
    category: { en: "Art", zh: "艺术", ar: "فن" },
    question: {
      en: "Who painted the Mona Lisa?",
      zh: "谁画了《蒙娜丽莎》？",
      ar: "من رسم الموناليزا؟"
    },
    options: {
      en: ["Van Gogh", "Picasso", "Da Vinci", "Monet"],
      zh: ["梵高", "毕加索", "达芬奇", "莫奈"],
      ar: ["فان جوخ", "بيكاسو", "دا فينشي", "مونيه"]
    },
    answer: 2,
  },
  {
    category: { en: "Geography", zh: "地理", ar: "جغرافيا" },
    question: {
      en: "What is the largest ocean on Earth?",
      zh: "地球上最大的海洋是什么？",
      ar: "ما هو أكبر محيط على وجه الأرض؟"
    },
    options: {
      en: ["Atlantic", "Indian", "Arctic", "Pacific"],
      zh: ["大西洋", "印度洋", "北冰洋", "太平洋"],
      ar: ["الأطلسي", "الهندي", "المتجمد الشمالي", "الهادئ"]
    },
    answer: 3,
  },
  {
    category: { en: "General", zh: "常识", ar: "عام" },
    question: {
      en: "How many continents are there on Earth?",
      zh: "地球上有多少个大洲？",
      ar: "كم عدد القارات على الأرض؟"
    },
    options: {
      en: ["5", "6", "7", "8"],
      zh: ["5", "6", "7", "8"],
      ar: ["5", "6", "7", "8"]
    },
    answer: 2,
  },
  {
    category: { en: "Animals", zh: "动物", ar: "حيوانات" },
    question: {
      en: "Which is the fastest land animal?",
      zh: "哪种是陆地上跑得最快的动物？",
      ar: "ما هو أسرع حيوان بري？"
    },
    options: {
      en: ["Lion", "Cheetah", "Horse", "Ostrich"],
      zh: ["狮子", "猎豹", "马", "鸵鸟"],
      ar: ["أسد", "فهد", "حصان", "نعامة"]
    },
    answer: 1,
  },
  {
    category: { en: "Science", zh: "科学", ar: "علوم" },
    question: {
      en: "What is the boiling point of water?",
      zh: "水的沸点是多少度？",
      ar: "ما هي درجة غليان الماء？"
    },
    options: {
      en: ["90°C", "100°C", "110°C", "120°C"],
      zh: ["90°C", "100°C", "110°C", "120°C"],
      ar: ["90°C", "100°C", "110°C", "120°C"]
    },
    answer: 1,
  }
];

const QUESTION_TIME = 10;
const START_DELAY = 3;
const RESULT_DELAY = 3;

function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      status: 'waiting',
      players: [],
      currentQuestionIndex: 0,
      timer: 0,
      questions: [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5),
      gameInterval: null,
    });
  }
  return rooms.get(roomId)!;
}

function broadcastState(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit('stateUpdate', room);
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', ({ name, roomId, playerId }: { name: string, roomId: string, playerId?: string }) => {
    const actualRoomId = roomId || 'default';
    socket.join(actualRoomId);
    
    const room = getRoom(actualRoomId);
    
    // Check if player is rejoining
    let player = room.players.find(p => p.id === playerId);
    
    if (player) {
      // Update socket ID if it changed (reconnection)
      // Note: In a real app, we'd map playerId to socketId
      // For this demo, we'll just update the player's ID to the new socket ID
      // or keep a separate persistent ID. Let's use the provided playerId if it exists.
      player.id = socket.id; 
    } else {
      const isHost = room.players.length === 0;
      player = {
        id: socket.id,
        name: name || `Player ${room.players.length + 1}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`,
        score: 0,
        isHost,
        ready: false,
        level: Math.floor(Math.random() * 10) + 1,
        totalWins: Math.floor(Math.random() * 5),
      };
      room.players.push(player);
    }
    
    socket.emit('joined', { playerId: player.id });
    socket.emit('globalLeaderboard', GLOBAL_LEADERBOARD);
    broadcastState(actualRoomId);
  });

  socket.on('sendEmoji', ({ roomId, emoji }: { roomId: string, emoji: string }) => {
    const actualRoomId = roomId || 'default';
    io.to(actualRoomId).emit('emojiReceived', { playerId: socket.id, emoji });
  });

  socket.on('startGame', (roomId: string) => {
    const actualRoomId = roomId || 'default';
    const room = rooms.get(actualRoomId);
    const player = room?.players.find(p => p.id === socket.id);
    
    if (player?.isHost && room?.status === 'waiting' && room.players.length >= 1) {
      startCountdown(actualRoomId);
    }
  });

  socket.on('submitAnswer', ({ roomId, answerIndex }: { roomId: string, answerIndex: number }) => {
    const actualRoomId = roomId || 'default';
    const room = rooms.get(actualRoomId);
    if (!room || room.status !== 'playing') return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player && player.lastAnswerIndex === undefined) {
      player.lastAnswerIndex = answerIndex;
      const currentQuestion = room.questions[room.currentQuestionIndex];
      
      if (answerIndex === currentQuestion.answer) {
        // M1 Scoring Algorithm: 200 - (timeUsed * 13), min 20
        const timeUsed = QUESTION_TIME - room.timer;
        let points = Math.max(20, 200 - (timeUsed * 13));
        
        // Double score for the 5th question
        if (room.currentQuestionIndex === 4) {
          points *= 2;
        }
        
        player.score += Math.round(points);
        player.lastAnswerCorrect = true;
      } else {
        player.lastAnswerCorrect = false;
      }
      broadcastState(actualRoomId);
    }
  });

  socket.on('resetGame', (roomId: string) => {
    const actualRoomId = roomId || 'default';
    const room = rooms.get(actualRoomId);
    const player = room?.players.find(p => p.id === socket.id);
    
    if (player?.isHost) {
      room.status = 'waiting';
      room.currentQuestionIndex = 0;
      room.questions = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
      room.players.forEach(p => {
        p.score = 0;
        p.ready = false;
        p.lastAnswerCorrect = undefined;
        p.lastAnswerIndex = undefined;
      });
      broadcastState(actualRoomId);
    }
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      const room = rooms.get(roomId);
      if (room) {
        const index = room.players.findIndex(p => p.id === socket.id);
        if (index !== -1) {
          const wasHost = room.players[index].isHost;
          room.players.splice(index, 1);
          
          if (wasHost && room.players.length > 0) {
            room.players[0].isHost = true;
          }
          
          if (room.players.length === 0) {
            if (room.gameInterval) clearInterval(room.gameInterval);
            rooms.delete(roomId);
          } else {
            broadcastState(roomId);
          }
        }
      }
    }
  });
});

function startCountdown(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.status = 'starting';
  room.timer = START_DELAY;
  broadcastState(roomId);

  const interval = setInterval(() => {
    room.timer--;
    if (room.timer <= 0) {
      clearInterval(interval);
      startGameLoop(roomId);
    }
    broadcastState(roomId);
  }, 1000);
}

function startGameLoop(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.status = 'playing';
  room.currentQuestionIndex = 0;
  nextQuestion(roomId);
}

function nextQuestion(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.status = 'playing';
  room.timer = QUESTION_TIME;
  room.players.forEach(p => {
    p.lastAnswerCorrect = undefined;
    p.lastAnswerIndex = undefined;
  });
  broadcastState(roomId);

  room.gameInterval = setInterval(() => {
    room.timer--;
    
    // Check if everyone answered
    const allAnswered = room.players.every(p => p.lastAnswerIndex !== undefined);
    
    if (room.timer <= 0 || allAnswered) {
      if (room.gameInterval) clearInterval(room.gameInterval);
      showAnswerResult(roomId);
    }
    broadcastState(roomId);
  }, 1000);
}

function showAnswerResult(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.status = 'answer_result';
  room.timer = RESULT_DELAY;
  broadcastState(roomId);

  const interval = setInterval(() => {
    room.timer--;
    if (room.timer <= 0) {
      clearInterval(interval);
      
      if (room.currentQuestionIndex < room.questions.length - 1) {
        room.currentQuestionIndex++;
        nextQuestion(roomId);
      } else {
        room.status = 'result';
        broadcastState(roomId);
      }
    }
    broadcastState(roomId);
  }, 1000);
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
