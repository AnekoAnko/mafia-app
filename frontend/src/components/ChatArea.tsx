import { useRef, useEffect } from 'react';
import { Message, PHASES } from '../types/types';

interface ChatAreaProps {
  messages: Message[];
  message: string;
  setMessage: (message: string) => void;
  sendMessage: () => void;
  socketId: string | undefined;
  phase: string;
  roleTeam?: string;
}

const ChatArea = ({
  messages,
  message,
  setMessage,
  sendMessage,
  socketId,
  phase,
  roleTeam
}: ChatAreaProps) => {
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const showChatInput =
    phase === PHASES.LOBBY ||
    phase === PHASES.DAY ||
    (phase === PHASES.NIGHT && roleTeam === 'mafia');

  return (
    <div className="flex-1 flex flex-col">
      <div
        ref={chatBoxRef}
        className="flex-1 p-4 overflow-y-auto bg-gray-50"
      >
        <div className="space-y-2 flex flex-col">
          {messages.map((msg, index) => {
            const isOwn = msg.id === socketId;
            const isSystem = msg.isSystem;
            const isMafia = msg.isMafiaChat;

            return (
              <div
                key={index}
                className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[75%] px-4 py-2 rounded-2xl shadow
                    ${isSystem
                      ? 'bg-gray-300 text-gray-800 text-sm'
                      : isMafia
                        ? 'bg-red-100 text-red-800'
                        : isOwn
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-300 text-gray-900 border'
                    }
                  `}
                >
                  {!isOwn && !isSystem && (
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      {msg.sender}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showChatInput && (
        <div className="p-4 bg-white border-t">
          <div className="flex">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-l-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={
                phase === PHASES.NIGHT && roleTeam === 'mafia'
                  ? 'Mafia chat (only mafia can see)'
                  : 'Type a message...'
              }
            />
            <button
              onClick={sendMessage}
              className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer text-white px-5 py-2 rounded-r-full"
            >
              Відправити message
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;
