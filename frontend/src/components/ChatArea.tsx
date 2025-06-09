import { useRef, useEffect } from 'react';
import { Message, PHASES } from '../types/types';
import bgImage from "../../assets/mafia-bg.png"

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
  console.log(messages)
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
    <div className="flex-1 flex flex-col" style={{backgroundImage:`url(${bgImage})`}}>
      <div 
        ref={chatBoxRef}
        className="flex-1 p-4 overflow-y-auto"
      >
        <div className="space-y-2">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`p-5 rounded mt-12 opacity-[0.95] ${
                msg.isSystem 
                  ? 'bg-gray-800 text-white' 
                  : msg.isMafiaChat 
                    ? 'bg-red-100 text-red-800' 
                    : msg.id === socketId 
                      ? 'bg-indigo-700 text-white' 
                      : 'bg-white'
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
        <div className="p-4 bg-gray-800 border-t">
          <div className="flex">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 px-3 py-2 border placeholder:white text-white border-gray-300 rounded-l focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={
                phase === PHASES.NIGHT && roleTeam === 'mafia'
                  ? "Mafia chat (only mafia can see)"
                  : "Type a message..."
              }
            />
            <button
              onClick={sendMessage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-r cursor-pointer"
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