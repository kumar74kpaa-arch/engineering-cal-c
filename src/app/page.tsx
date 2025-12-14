"use client";

import { useState, useRef, useEffect, type MouseEvent, ChangeEvent } from "react";
import { ArrowLeft, Send, Trash2, Paperclip, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  useFirebase, 
  useCollection, 
  initiateAnonymousSignIn,
  addDocumentNonBlocking,
  useMemoFirebase
} from "@/firebase";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, orderBy, serverTimestamp, doc, writeBatch } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";

type Operator = "+" | "-" | "×" | "÷";

interface Message {
  id: string;
  text?: string;
  timestamp: any;
  sender: string;
  type: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
}

export default function EngineeringCalculatorPage() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const pressStartTime = useRef<number>(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const recordedChunks = useRef<Blob[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);


  const [displayValue, setDisplayValue] = useState("0");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  const { auth, firestore, user, isUserLoading, firebaseApp } = useFirebase();
  const storage = firebaseApp ? getStorage(firebaseApp) : null;

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const messagesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'chat_messages');
  }, [firestore]);

  const messagesQuery = useMemoFirebase(() => {
    if (!messagesCollectionRef) return null;
    return query(messagesCollectionRef, orderBy("timestamp", "asc"));
  }, [messagesCollectionRef]);
  
  const { data: messages, isLoading: isLoadingMessages } = useCollection<Omit<Message, 'id'>>(messagesQuery);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollableView = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollableView) {
        scrollableView.scrollTop = scrollableView.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (isChatVisible) {
      scrollToBottom();
    }
  }, [isChatVisible, messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() === "" || !user || !messagesCollectionRef) return;
    const message = {
      text: newMessage,
      timestamp: serverTimestamp(),
      sender: user.uid,
      type: 'text' as const,
    };
    addDocumentNonBlocking(messagesCollectionRef, message);
    setNewMessage("");
  };

  const handleClearChat = async () => {
    if (!firestore || !messages || messages.length === 0) return;
    const batch = writeBatch(firestore);
    messages.forEach(message => {
      const docRef = doc(firestore, "chat_messages", message.id);
      batch.delete(docRef);
    });
    await batch.commit().catch(error => {
      console.error("Error clearing chat history:", error);
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !storage) return;

    const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!fileType) {
      console.error("Unsupported file type");
      return;
    }
    
    setUploadProgress(0);
    const storagePath = `chat_media/${user.uid}/${Date.now()}_${file.name}`;
    const fileStorageRef = storageRef(storage, storagePath);

    try {
      const uploadTask = uploadBytes(fileStorageRef, file);
      // This is a simplified progress; for real progress, you'd use uploadBytesResumable
      // For now, we'll just simulate it.
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUploadProgress(50);
      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);
      setUploadProgress(100);


      if (messagesCollectionRef) {
          addDocumentNonBlocking(messagesCollectionRef, {
              sender: user.uid,
              timestamp: serverTimestamp(),
              type: fileType,
              mediaUrl: downloadURL,
          });
      }
      
      setTimeout(() => setUploadProgress(null), 1000);

    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadProgress(null);
    }
};

  const handleRecord = async () => {
    if (recording) {
      mediaRecorder?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        setMediaRecorder(recorder);
        recorder.ondataavailable = (event) => {
          recordedChunks.current.push(event.data);
        };
        recorder.onstop = async () => {
          const audioBlob = new Blob(recordedChunks.current, { type: 'audio/webm' });
          recordedChunks.current = [];
          if (!user || !storage || !messagesCollectionRef) return;

          setUploadProgress(0);
          const storagePath = `chat_audio/${user.uid}/${Date.now()}.webm`;
          const audioStorageRef = storageRef(storage, storagePath);
          
          try {
            await uploadBytes(audioStorageRef, audioBlob);
            setUploadProgress(50);
            const downloadURL = await getDownloadURL(audioStorageRef);
            setUploadProgress(100);
            addDocumentNonBlocking(messagesCollectionRef, {
              sender: user.uid,
              timestamp: serverTimestamp(),
              type: 'audio',
              mediaUrl: downloadURL,
            });
            setTimeout(() => setUploadProgress(null), 1000);
          } catch(error) {
            console.error("Error uploading audio:", error)
            setUploadProgress(null);
          }
        };
        recorder.start();
        setRecording(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
  };


  const handleDigit = (digit: string) => {
    if (waitingForSecondOperand) {
      setDisplayValue(digit);
      setWaitingForSecondOperand(false);
    } else {
      setDisplayValue(displayValue === "0" ? digit : displayValue + digit);
    }
  };

  const handleDecimal = () => {
    if (!displayValue.includes(".")) {
      setDisplayValue(displayValue + ".");
    }
  };

  const handleOperator = (nextOperator: Operator) => {
    const inputValue = parseFloat(displayValue);

    if (operator && waitingForSecondOperand) {
      setOperator(nextOperator);
      return;
    }

    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator) {
      const result = calculate(firstOperand, inputValue, operator);
      setDisplayValue(String(result));
      setFirstOperand(result);
    }

    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (op1: number, op2: number, op: Operator): number => {
    switch (op) {
      case "+": return op1 + op2;
      case "-": return op1 - op2;
      case "×": return op1 * op2;
      case "÷": return op2 === 0 ? Infinity : op1 / op2;
      default: return op2;
    }
  };
  
  const handleEquals = () => {
    if (operator && firstOperand !== null) {
      const inputValue = parseFloat(displayValue);
      const result = calculate(firstOperand, inputValue, operator);
      const resultString = String(Number(result.toPrecision(15)));
      setDisplayValue(resultString);
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(false);
    }
  };
  
  const handleClear = () => {
    setDisplayValue("0");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };
  
  const handleEqualsMouseDown = () => {
    pressStartTime.current = Date.now();
  };

  const handleEqualsMouseUp = (e: MouseEvent<HTMLButtonElement>) => {
    const pressDuration = Date.now() - pressStartTime.current;
    if (pressDuration > 500) {
      e.preventDefault();
      setIsChatVisible(true);
    } else {
      handleEquals();
    }
  };

  const CalculatorButton = ({
    onClick,
    onMouseDown,
    onMouseUp,
    children,
    className,
    variant = "secondary",
  }: {
    onClick?: () => void;
    onMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void;
    onMouseUp?: (e: MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "default" | "destructive" | "outline" | "ghost" | "link" | null | undefined;
  }) => (
    <Button
      variant={variant}
      className={cn("h-20 w-full text-3xl font-semibold rounded-xl shadow-md", className)}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={onMouseDown ? () => (pressStartTime.current = Date.now()) : undefined}
      onTouchEnd={onMouseUp ? (e) => { e.preventDefault(); handleEqualsMouseUp(e as any); } : undefined}
    >
      {children}
    </Button>
  );

  const calculatorButtons = [
    { label: "C", handler: handleClear, variant: 'destructive' as const, className: 'bg-red-500 hover:bg-red-600 text-white' },
    { label: "7", handler: () => handleDigit("7") },
    { label: "8", handler: () => handleDigit("8") },
    { label: "9", handler: () => handleDigit("9") },
    { label: "÷", handler: () => handleOperator("÷"), variant: 'primary' as const },
    { label: "4", handler: () => handleDigit("4") },
    { label: "5", handler: () => handleDigit("5") },
    { label: "6", handler: () => handleDigit("6") },
    { label: "×", handler: () => handleOperator("×"), variant: 'primary' as const },
    { label: "1", handler: () => handleDigit("1") },
    { label: "2", handler: () => handleDigit("2") },
    { label: "3", handler: () => handleDigit("3") },
    { label: "-", handler: () => handleOperator("-"), variant: 'primary' as const },
    { label: "0", handler: () => handleDigit("0") },
    { label: ".", handler: () => handleDecimal() },
    { label: "+", handler: () => handleOperator("+"), variant: 'primary' as const },
  ];

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const renderMessageContent = (message: Message) => {
    switch (message.type) {
        case 'text':
            return <p className="text-sm">{message.text}</p>;
        case 'image':
            return <img src={message.mediaUrl} alt="Sent Image" className="rounded-lg max-w-full h-auto" />;
        case 'video':
            return <video src={message.mediaUrl} controls className="rounded-lg max-w-full h-auto" />;
        case 'audio':
            return <audio src={message.mediaUrl} controls className="w-full" />;
        default:
            return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full p-4 text-center">
        <h1 className="text-2xl font-bold text-primary">Engineering Cal C</h1>
      </div>
      <div className="flex-grow flex items-center justify-center w-full">
        <Card className="w-full max-w-sm mx-auto shadow-2xl rounded-3xl overflow-hidden bg-card">
          <CardContent className="p-6">
            <div className="bg-muted text-right p-4 rounded-xl mb-6 shadow-inner">
              <p className="text-5xl font-light text-muted-foreground break-all" style={{ minHeight: '3.75rem' }}>{displayValue}</p>
            </div>
            <div className="grid grid-cols-4 grid-rows-4 gap-4">
               <CalculatorButton onClick={handleClear} variant='destructive' className="bg-red-500 hover:bg-red-600 text-white">C</CalculatorButton>
              {calculatorButtons.slice(1).map((btn) => (
                <CalculatorButton key={btn.label} onClick={btn.handler} variant={btn.variant}>
                  {btn.label}
                </CalculatorButton>
              ))}
            </div>
            <div className="mt-4">
              <CalculatorButton
                onMouseDown={handleEqualsMouseDown}
                onMouseUp={handleEqualsMouseUp}
                variant="primary"
                className="w-full"
              >
                =
              </CalculatorButton>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Chat Interface */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300",
          isChatVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Card className="w-full max-w-sm h-[90vh] max-h-[700px] flex flex-col shadow-2xl rounded-3xl bg-card">
          <div className="flex items-center p-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setIsChatVisible(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold mx-auto pr-8">Private Chat</h2>
          </div>
          <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
             {uploadProgress !== null && (
              <div className="p-4">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-center mt-1">{uploadProgress}% uploaded</p>
              </div>
            )}
            <div className="space-y-4">
              {isLoadingMessages && <p>Loading messages...</p>}
              {messages && messages.map((message) => (
                <div key={message.id} className={cn("flex flex-col space-y-1", user?.uid === message.sender ? "items-end" : "items-start")}>
                  <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", user?.uid === message.sender ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                    {renderMessageContent(message)}
                  </div>
                  <span className="text-xs text-muted-foreground pl-1">{formatTimestamp(message.timestamp)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <div className="flex items-center space-x-2">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
              <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={!user}>
                  <Paperclip className="h-5 w-5" />
              </Button>
               <Button size="icon" variant="ghost" onClick={handleRecord} disabled={!user} className={cn(recording && "bg-red-500 text-white hover:bg-red-600")}>
                  {recording ? <X className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-grow"
                disabled={!user || recording}
              />
              <Button size="icon" onClick={handleSendMessage} disabled={!user || recording}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <Button variant="outline" className="w-full mt-2" onClick={handleClearChat} disabled={!user}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear History
            </Button>
          </div>
        </Card>
      </div>
      <div className="w-full text-center py-4">
        <p className="text-sm text-muted-foreground">Made by KumarTechnologies</p>
      </div>
    </div>
  );
}
