"use client";

import { useState, useRef, useEffect, type MouseEvent } from "react";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "×" | "÷";

interface Message {
  id: number;
  text: string;
  timestamp: string;
}

export default function EngineeringCalculatorPage() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [messages, setMessages] = useLocalStorage<Message[]>("chatMessages", []);
  const [newMessage, setNewMessage] = useState("");
  const pressStartTime = useRef<number>(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [displayValue, setDisplayValue] = useState("0");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

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
    if (newMessage.trim() === "") return;
    const message: Message = {
      id: Date.now(),
      text: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, message]);
    setNewMessage("");
  };

  const handleClearChat = () => {
    setMessages([]);
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
    { label: "C", handler: handleClear, variant: 'destructive' as const, className: 'bg-accent text-accent-foreground' },
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm mx-auto shadow-2xl rounded-3xl overflow-hidden">
        <CardContent className="p-6">
          <div className="bg-muted text-right p-4 rounded-xl mb-6 shadow-inner">
            <p className="text-5xl font-light text-muted-foreground break-all" style={{ minHeight: '3.75rem' }}>{displayValue}</p>
          </div>
          <div className="grid grid-cols-4 grid-rows-4 gap-4">
            {calculatorButtons.slice(1).map((btn) => (
              <CalculatorButton key={btn.label} onClick={btn.handler} variant={btn.variant}>
                {btn.label}
              </CalculatorButton>
            ))}
             <CalculatorButton onClick={handleClear} variant='destructive' className="bg-accent text-accent-foreground">C</CalculatorButton>
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
      
      {/* Chat Interface */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300",
          isChatVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Card className="w-full max-w-sm h-[90vh] max-h-[700px] flex flex-col shadow-2xl rounded-3xl">
          <div className="flex items-center p-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setIsChatVisible(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold mx-auto pr-8">Private Chat</h2>
          </div>
          <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex flex-col items-start space-y-1">
                  <div className="rounded-lg bg-secondary px-4 py-2 max-w-[80%]">
                    <p className="text-sm">{message.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground pl-1">{message.timestamp}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <div className="flex items-center space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-grow"
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <Button variant="outline" className="w-full mt-2" onClick={handleClearChat}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear History
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}