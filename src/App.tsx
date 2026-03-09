import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from './translations';
import { 
  Trophy, 
  Users, 
  Timer, 
  Play, 
  HelpCircle, 
  CheckCircle2, 
  Gift,
  UserPlus,
  ChevronRight
} from 'lucide-react';

// Types
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  ready: boolean;
  lastAnswerCorrect?: boolean;
  lastAnswerIndex?: number;
}

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

interface GameState {
  status: 'waiting' | 'starting' | 'playing' | 'answer_result' | 'result';
  players: Player[];
  currentQuestionIndex: number;
  timer: number;
  questions: Question[];
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [roomId, setRoomId] = useState('default');

  useEffect(() => {
    // Get roomId from URL if present
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room') || 'default';
    setRoomId(rId);

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      (window as any).socketId = newSocket.id;
    });

    newSocket.on('joined', ({ playerId }: { playerId: string }) => {
      localStorage.setItem('quiz_playerId', playerId);
    });

    newSocket.on('stateUpdate', (state: GameState) => {
      setGameState(state);
      
      // Sync selected answer from server state
      const me = state.players.find(p => p.id === newSocket.id);
      if (me && me.lastAnswerIndex !== undefined) {
        setSelectedAnswer(me.lastAnswerIndex);
      } else if (state.status === 'playing' && state.timer === 10) {
        // Reset local selection at the start of a new question
        setSelectedAnswer(null);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoin = () => {
    if (socket && name.trim()) {
      const savedPlayerId = localStorage.getItem('quiz_playerId');
      socket.emit('join', { name, roomId, playerId: savedPlayerId });
      setJoined(true);
      const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
      if (!hasSeenTutorial) {
        setShowTutorial(true);
        localStorage.setItem('hasSeenTutorial', 'true');
      }
    }
  };

  const handleStart = () => {
    socket?.emit('startGame', roomId);
  };

  const handleSubmitAnswer = (index: number) => {
    if (selectedAnswer === null && gameState?.status === 'playing') {
      setSelectedAnswer(index);
      socket?.emit('submitAnswer', { roomId, answerIndex: index });
    }
  };

  const handleReset = () => {
    socket?.emit('resetGame', roomId);
  };

  useEffect(() => {
    setSelectedAnswer(null);
  }, [gameState?.currentQuestionIndex]);

  const t = translations[language];
  const isRTL = language === 'ar';

  if (!joined) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 bg-bg ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-neon-purple blur opacity-75 rounded-full animate-pulse"></div>
            <div className="relative bg-bg p-6 rounded-full border-2 border-neon-purple">
              <Trophy className="w-16 h-16 text-neon-purple" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter neon-text-purple uppercase italic">
              {t.title}
            </h1>
            <p className="text-white/60 text-sm">{t.subtitle}</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder={t.enterNickname}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-neon-purple transition-all"
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim()}
              className="w-full bg-neon-purple hover:bg-neon-purple/80 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-neon-purple/20 flex items-center justify-center gap-2 group"
            >
              {t.enterLobby}
              <ChevronRight className={`w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!gameState) return null;

  const me = gameState.players.find(p => p.id === socket?.id);

  return (
    <div className={`min-h-screen bg-bg text-white flex flex-col relative overflow-hidden pt-[120px] ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-neon-purple/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <header className="fixed top-0 left-0 right-0 p-4 flex items-center justify-between z-50 bg-bg/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-neon-purple p-1">
            <img src={me?.avatar} alt="Avatar" className="w-full h-full rounded-full" referrerPolicy="no-referrer" />
          </div>
          <div>
            <div className="text-xs text-white/50 font-medium uppercase tracking-wider">{t.player}</div>
            <div className="font-bold text-sm">{me?.name}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTutorial(true)}
            className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
          >
            <HelpCircle className="w-5 h-5 text-white/60" />
          </button>
          <div className="px-4 py-1.5 bg-neon-purple/20 border border-neon-purple/30 rounded-full flex items-center gap-2">
            <Trophy className="w-4 h-4 text-neon-yellow" />
            <span className="font-bold text-sm text-neon-yellow">{me?.score || 0}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 z-10">
        <AnimatePresence mode="wait">
          {gameState.status === 'waiting' && (
            <Lobby 
              gameState={gameState} 
              isHost={me?.isHost || false} 
              onStart={handleStart} 
              language={language}
            />
          )}

          {gameState.status === 'starting' && (
            <Countdown timer={gameState.timer} language={language} players={gameState.players} />
          )}

          {gameState.status === 'playing' || gameState.status === 'answer_result' ? (
            <Quiz 
              gameState={gameState} 
              selectedAnswer={selectedAnswer} 
              onSelect={handleSubmitAnswer} 
              language={language}
            />
          ) : null}

          {gameState.status === 'result' && (
            <FinalResult 
              gameState={gameState} 
              isHost={me?.isHost || false} 
              onReset={handleReset} 
              language={language}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showTutorial && (
          <Tutorial 
            onClose={() => setShowTutorial(false)} 
            language={language} 
            setLanguage={setLanguage} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Lobby({ gameState, isHost, onStart, language }: { gameState: GameState, isHost: boolean, onStart: () => void, language: Language }) {
  const t = translations[language];
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col space-y-6"
    >
      <div className="flex-1 flex flex-col justify-center items-center space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black italic uppercase neon-text-cyan">{t.waitingRoom}</h2>
          <p className="text-white/50 text-sm">{language === 'en' ? "Waiting for more players to join the party..." : language === 'zh' ? "等待更多玩家加入派对..." : "في انتظار انضمام المزيد من اللاعبين إلى الحفلة..."}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
          {Array.from({ length: 6 }).map((_, i) => {
            const player = gameState.players[i];
            return (
              <div key={i} className="flex flex-col items-center space-y-2">
                <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center relative transition-all ${
                  player ? 'border-neon-purple bg-neon-purple/10' : 'border-white/5 bg-white/5 border-dashed'
                }`}>
                  {player ? (
                    <>
                      <img src={player.avatar} alt={player.name} className="w-12 h-12" referrerPolicy="no-referrer" />
                      {player.isHost && (
                        <div className="absolute -top-2 -right-2 bg-neon-yellow text-bg text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase">
                          {t.host}
                        </div>
                      )}
                    </>
                  ) : (
                    <Users className="w-6 h-6 text-white/10" />
                  )}
                </div>
                <span className="text-[10px] font-medium text-white/40 truncate w-full text-center">
                  {player ? player.name : t.waiting}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {isHost ? (
          <button
            onClick={onStart}
            disabled={gameState.players.length < 1}
            className="w-full bg-neon-cyan hover:bg-neon-cyan/80 disabled:opacity-50 text-bg font-black py-4 rounded-2xl transition-all shadow-lg shadow-neon-cyan/20 flex items-center justify-center gap-2 uppercase italic"
          >
            <Play className={`w-5 h-5 fill-current ${language === 'ar' ? 'rotate-180' : ''}`} />
            {t.startGame}
          </button>
        ) : (
          <div className="w-full py-4 text-center text-white/40 text-sm font-medium animate-pulse">
            {language === 'en' ? "Waiting for host to start..." : language === 'zh' ? "等待房主开始..." : "في انتظار المضيف للبدء..."}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Countdown({ timer, language, players }: { timer: number, language: Language, players: Player[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center space-y-12 relative overflow-hidden"
    >
      {/* Avatars flying in animation */}
      <div className="relative w-64 h-64">
        {players.map((p, i) => {
          const angle = (i / players.length) * Math.PI * 2;
          const x = Math.cos(angle) * 200;
          const y = Math.sin(angle) * 200;
          return (
            <motion.div
              key={p.id}
              initial={{ x, y, opacity: 0, scale: 0 }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="w-16 h-16 rounded-full border-4 border-neon-purple p-1 bg-bg shadow-[0_0_20px_rgba(180,69,255,0.3)]">
                <img src={p.avatar} alt="" className="w-full h-full rounded-full" referrerPolicy="no-referrer" />
              </div>
            </motion.div>
          );
        })}
        
        <motion.div
          key={timer}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl font-black italic text-neon-purple neon-text-purple z-10"
        >
          {timer}
        </motion.div>
      </div>

      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-2xl font-black uppercase tracking-[0.3em] text-white italic"
      >
        {language === 'en' ? "Get Ready!" : language === 'zh' ? "准备好了吗！" : "استعد!"}
      </motion.p>
    </motion.div>
  );
}

function Quiz({ gameState, selectedAnswer, onSelect, language }: { gameState: GameState, selectedAnswer: number | null, onSelect: (i: number) => void, language: Language }) {
  const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
  const timerPercentage = (gameState.timer / 10) * 100;
  const t = translations[language];

  // Get localized question and options
  const questionText = currentQuestion.question[language] || currentQuestion.question.en;
  const options = currentQuestion.options[language] || currentQuestion.options.en;

  const isAnswerResult = gameState.status === 'answer_result';
  
  // Dynamic timer color
  const timerColor = gameState.timer > 5 ? 'bg-neon-cyan shadow-neon-cyan/50' : gameState.timer > 2 ? 'bg-neon-yellow shadow-neon-yellow/50' : 'bg-red-500 shadow-red-500/50';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1"
    >
      <div className="space-y-3 flex flex-col flex-1">
        {/* Category Badge */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="self-center px-4 py-1 rounded-full bg-white/10 border border-white/20 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
            {currentQuestion.category[language] || currentQuestion.category.en}
          </span>
        </motion.div>

        <div className="space-y-2 shrink-0">
          <div className="flex justify-between items-end">
            <div className="space-y-0.5">
              <div className="text-[10px] font-black text-neon-cyan uppercase tracking-widest">
                {t.question} {gameState.currentQuestionIndex + 1 === 5 && <span className="text-neon-yellow ml-2">2X POINTS!</span>}
              </div>
              <div className="text-xl font-black italic">
                {gameState.currentQuestionIndex + 1}
                <span className="text-white/20 text-base"> / {gameState.questions.length}</span>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-0.5">
              <div className={`flex items-center gap-2 transition-colors duration-300 ${gameState.timer <= 2 ? 'text-red-500 animate-pulse' : gameState.timer <= 5 ? 'text-neon-yellow' : 'text-neon-yellow'}`}>
                <Timer className="w-4 h-4" />
                <span className="font-black text-lg italic">{gameState.timer}s</span>
              </div>
            </div>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full transition-colors duration-500 ${timerColor}`}
              initial={{ width: '100%' }}
              animate={{ width: `${timerPercentage}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        </div>

        <div className="shrink-0">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple"></div>
            <h3 className="text-lg font-bold leading-tight">
              {questionText}
            </h3>
          </div>
        </div>

        <div className="flex-1 space-y-2 py-1 relative">
          <div className="grid grid-cols-1 gap-2">
            {options.map((option, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = i === currentQuestion.answer;
              
              // Find other players who chose this option
              const othersWhoChose = gameState.players.filter(p => p.id !== (window as any).socketId && p.lastAnswerIndex === i);

              let buttonClass = 'border-white/5 bg-white/5 hover:border-white/20';
              if (isSelected) {
                buttonClass = 'border-neon-purple bg-neon-purple/20 shadow-lg shadow-neon-purple/10';
              }
              
              if (isAnswerResult) {
                if (isCorrect) {
                  buttonClass = 'border-neon-cyan bg-neon-cyan/20 shadow-lg shadow-neon-cyan/20';
                } else if (isSelected) {
                  buttonClass = 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/20';
                }
              }

              return (
                <motion.button
                  key={i}
                  whileHover={{ scale: isAnswerResult ? 1 : 1.02 }}
                  whileTap={{ scale: isAnswerResult ? 1 : 0.98 }}
                  onClick={() => onSelect(i)}
                  disabled={selectedAnswer !== null || isAnswerResult}
                  className={`w-full p-4 rounded-xl border-2 text-left font-bold transition-all relative group overflow-hidden ${buttonClass}`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        isSelected ? 'bg-neon-purple text-white' : 'bg-white/10 text-white/40'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm">{option}</span>
                    </div>
                    {isSelected && !isAnswerResult && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="w-4 h-4 text-neon-purple" />
                      </motion.div>
                    )}
                    {isAnswerResult && isCorrect && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="w-4 h-4 text-neon-cyan" />
                      </motion.div>
                    )}
                  </div>

                  {/* Others' avatars */}
                  <div className="absolute bottom-2 right-2 flex -space-x-2 overflow-hidden">
                    {othersWhoChose.map((p) => (
                      <motion.img
                        key={p.id}
                        initial={{ scale: 0, x: 10 }}
                        animate={{ scale: 1, x: 0 }}
                        src={p.avatar}
                        alt={p.name}
                        className="w-6 h-6 rounded-full border-2 border-bg shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {selectedAnswer !== null && !isAnswerResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[2px] rounded-xl z-20">
              <div className="bg-neon-purple/90 text-white px-6 py-3 rounded-full font-black italic uppercase text-sm shadow-xl animate-pulse">
                {t.waitingForOthers}
              </div>
            </div>
          )}

          {isAnswerResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <motion.div 
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className={`px-8 py-4 rounded-2xl font-black italic uppercase text-2xl shadow-2xl ${
                  gameState.players.find(p => p.id === (window as any).socketId)?.lastAnswerCorrect 
                    ? 'bg-neon-cyan text-bg shadow-neon-cyan/50' 
                    : 'bg-red-500 text-white shadow-red-500/50'
                }`}
              >
                {gameState.players.find(p => p.id === (window as any).socketId)?.lastAnswerCorrect ? t.correct : t.wrong}
              </motion.div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1 shrink-0 no-scrollbar border-t border-white/5">
          <AnimatePresence mode="popLayout">
            {gameState.players.sort((a, b) => b.score - a.score).map((p, i) => (
              <motion.div 
                key={p.id} 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-shrink-0 flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1"
              >
                <span className="text-[10px] font-black text-white/30">{i + 1}</span>
                <img src={p.avatar} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                <span className="text-[10px] font-bold max-w-[60px] truncate">{p.name}</span>
                <span className="text-[10px] font-black text-neon-yellow">{p.score}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function FinalResult({ gameState, isHost, onReset, language }: { gameState: GameState, isHost: boolean, onReset: () => void, language: Language }) {
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const t = translations[language];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6"
    >
      <div className="text-center space-y-2 py-4">
        <h2 className="text-4xl font-black italic uppercase neon-text-purple">{t.gameOver}</h2>
        <p className="text-white/50 text-sm">{language === 'en' ? "The party is over, here are the winners!" : language === 'zh' ? "派对结束，这是我们的赢家！" : "انتهت الحفلة، إليكم الفائزين!"}</p>
      </div>

      <div className="flex items-end justify-center gap-2 h-48 mb-8">
        {sortedPlayers[1] && (
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img src={sortedPlayers[1].avatar} alt="" className="w-14 h-14 rounded-full border-2 border-white/20" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-2 -right-2 bg-white/20 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center">2</div>
            </div>
            <div className="w-20 bg-white/10 h-24 rounded-t-xl flex flex-col items-center justify-center p-2">
              <span className="text-[10px] font-bold truncate w-full text-center">{sortedPlayers[1].name}</span>
              <span className="text-xs font-black text-white/60">{sortedPlayers[1].score}</span>
            </div>
          </div>
        )}
        {sortedPlayers[0] && (
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <Trophy className="w-8 h-8 text-neon-yellow animate-bounce" />
              </div>
              <img src={sortedPlayers[0].avatar} alt="" className="w-20 h-20 rounded-full border-4 border-neon-yellow shadow-lg shadow-neon-yellow/20" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-2 -right-2 bg-neon-yellow text-bg text-xs font-black w-8 h-8 rounded-full flex items-center justify-center">1</div>
            </div>
            <div className="w-24 bg-neon-yellow/10 border-x border-t border-neon-yellow/30 h-32 rounded-t-2xl flex flex-col items-center justify-center p-2">
              <span className="text-xs font-black truncate w-full text-center text-neon-yellow">{sortedPlayers[0].name}</span>
              <span className="text-lg font-black text-neon-yellow">{sortedPlayers[0].score}</span>
            </div>
          </div>
        )}
        {sortedPlayers[2] && (
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img src={sortedPlayers[2].avatar} alt="" className="w-12 h-12 rounded-full border-2 border-white/10" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-2 -right-2 bg-white/10 text-white/60 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">3</div>
            </div>
            <div className="w-16 bg-white/5 h-20 rounded-t-xl flex flex-col items-center justify-center p-2">
              <span className="text-[10px] font-bold truncate w-full text-center">{sortedPlayers[2].name}</span>
              <span className="text-xs font-black text-white/40">{sortedPlayers[2].score}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {sortedPlayers.slice(3).map((p, i) => (
          <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-black text-white/20 w-4">{i + 4}</span>
              <img src={p.avatar} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
              <div>
                <div className="font-bold text-sm">{p.name}</div>
                <div className="text-[10px] text-white/40 uppercase font-black">{t.ranked} {i + 4}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-black text-neon-yellow">{p.score}</div>
                <div className="text-[10px] text-white/40 uppercase font-black">{t.points}</div>
              </div>
              <div className="flex gap-1">
                <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <Gift className="w-4 h-4 text-white/60" />
                </button>
                <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <UserPlus className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 space-y-3">
        {isHost ? (
          <button
            onClick={onReset}
            className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-neon-purple/20 flex items-center justify-center gap-2 uppercase italic"
          >
            {t.playAgain}
          </button>
        ) : (
          <div className="text-center text-white/40 text-xs font-bold animate-pulse uppercase">
            {language === 'en' ? "Waiting for host to restart..." : language === 'zh' ? "等待房主重新开始..." : "في انتظار المضيف لإعادة التشغيل..."}
          </div>
        )}
        <button className="w-full bg-white/5 hover:bg-white/10 text-white/60 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase italic">
          {t.backToRoom}
        </button>
      </div>
    </motion.div>
  );
}

function Tutorial({ onClose, language, setLanguage }: { onClose: () => void, language: Language, setLanguage: (l: Language) => void }) {
  const [step, setStep] = useState(0);
  const t = translations[language].tutorial;
  const common = translations[language];

  const steps = [
    {
      title: language === 'en' ? "Join the Party" : language === 'zh' ? "加入派对" : "انضم إلى الحفلة",
      desc: language === 'en' ? "Wait for the host to start the game. You can see other players joining in real-time." : language === 'zh' ? "等待房主开始游戏。你可以实时看到其他玩家加入。" : "انتظر المضيف لبدء اللعبة. يمكنك رؤية اللاعبين الآخرين ينضمون في الوقت الفعلي.",
      icon: <Users className="w-12 h-12 text-neon-cyan" />
    },
    {
      title: language === 'en' ? "Fastest Wins" : language === 'zh' ? "手速至上" : "الأسرع يفوز",
      desc: language === 'en' ? "Answer questions as quickly as possible. The faster you answer correctly, the more points you get!" : language === 'zh' ? "尽可能快地回答问题。答得越快，得分越高！" : "أجب على الأسئلة بأسرع ما يمكن. كلما أجبت بشكل أسرع، زادت النقاط التي تحصل عليها!",
      icon: <Timer className="w-12 h-12 text-neon-purple" />
    },
    {
      title: language === 'en' ? "Climb the Ranks" : language === 'zh' ? "冲击排名" : "ارتقِ في الرتب",
      desc: language === 'en' ? "Watch the leaderboard change after every question. Aim for the top spot to win the trophy!" : language === 'zh' ? "每道题后观察排行榜变化。目标是夺得冠军奖杯！" : "شاهد تغير لوحة المتصدرين بعد كل سؤال. استهدف المركز الأول للفوز بالكأس!",
      icon: <Trophy className="w-12 h-12 text-neon-yellow" />
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-bg/90 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
          <motion.div 
            className="h-full bg-neon-purple"
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
            {steps[step].icon}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black italic uppercase">{steps[step].title}</h3>
            <p className="text-white/60 text-sm leading-relaxed">{steps[step].desc}</p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="space-y-3">
          <div className="text-[10px] font-black text-white/30 uppercase tracking-widest text-center">{common.language}</div>
          <div className="flex gap-2">
            {(['en', 'zh', 'ar'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  language === lang 
                    ? 'bg-neon-purple text-white shadow-lg shadow-neon-purple/20' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {lang === 'en' ? 'English' : lang === 'zh' ? '中文' : 'العربية'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button 
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-4 bg-white/5 rounded-2xl font-bold text-white/60"
            >
              {t.back}
            </button>
          )}
          <button 
            onClick={() => {
              if (step < steps.length - 1) setStep(s => s + 1);
              else onClose();
            }}
            className="flex-[2] py-4 bg-neon-purple rounded-2xl font-black italic uppercase shadow-lg shadow-neon-purple/20"
          >
            {step < steps.length - 1 ? t.next : t.gotIt}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
