import { useRef, useEffect } from 'react';
import { Message } from '../types/types';
import { SendHorizonal } from 'lucide-react';
import bgChat from "../../assets/bg-chat3.png"

interface ChatAreaProps {
  messages: Message[];
  message: string;
  setMessage: (message: string) => void;
  sendMessage: () => void;
  socketId: string | undefined;
}

const ChatArea = ({
  messages,
  message,
  setMessage,
  sendMessage,
  socketId,
}: ChatAreaProps) => {
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col" style={{
    backgroundImage: `url(${bgChat})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  }}>
      <div
        ref={chatBoxRef}
        className="flex-1 p-4 overflow-y-auto"
      >
        <div className="space-y-3 flex flex-col">
          {messages.map((msg, index) => {
            const isOwn = msg.id === socketId;
            const isSystem = msg.isSystem;

            return (
              <div
                key={index}
                className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-md transition-all duration-300
                    ${isSystem
                      ? 'bg-gray-300 text-gray-800 text-sm italic'
                      : isOwn
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-200 text-gray-900'
                    }
                  `}
                >
                  {!isOwn && !isSystem && (
                    <div className="text-xs font-semibold text-gray-600 mb-1">
                      {msg.sender}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


        <div className="p-4 bg-gray-200 border-t">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder={
                'Type a message...'
              }
            />
            <button
              onClick={sendMessage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full transition cursor-pointer"
              title="Send message"
            >
              <SendHorizonal size={20}/>
            </button>
          </div>
        </div>
    </div>
  );
};

export default ChatArea;
