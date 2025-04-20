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
        className="flex-1 p-4 overflow-y-auto"
      >
        <div className="space-y-2">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`p-2 rounded ${
                msg.isSystem 
                  ? 'bg-gray-100 text-gray-800' 
                  : msg.isMafiaChat 
                    ? 'bg-red-100 text-red-800' 
                    : msg.id === socketId 
                      ? 'bg-indigo-100 text-indigo-800' 
                      : 'bg-white border'
              }`}
            >
              <div className="font-semibold">
                {msg.sender}
              </div>
              <div>{msg.message}</div>
            </div>
          ))}
        </div>
      </div>
      
      {showChatInput && (
        <div className="p-4 bg-white border-t">
          <div className="flex">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={
                phase === PHASES.NIGHT && roleTeam === 'mafia'
                  ? "Mafia chat (only mafia can see)"
                  : "Type a message..."
              }
            />
            <button
              onClick={sendMessage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-r"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;