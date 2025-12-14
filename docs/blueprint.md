# **App Name**: Engineering Calculator

## Core Features:

- Standard Calculator: Basic arithmetic operations including addition, subtraction, multiplication, and division with a numeric keypad and clear function.
- Hidden Chat Interface: Access to a private chat interface unlocked by long-pressing the '=' button, maintaining a hidden state during regular calculator use.
- Ephemeral Chat Storage: Utilize localStorage to persist messages within the chat session, which are cleared upon tab refresh or closure, ensuring no data retention.
- Chat Messaging: Allows users to send messages. Basic display and input functionality.
- Clear Chat History: Provide a button to clear all chat messages stored in localStorage.

## Style Guidelines:

- Primary color: Bright Red (#FF0000) for main elements.
- Background color: White (#FFFFFF), providing a clean and stark contrast.
- Accent color: A darker shade of red (#8B0000), used to draw attention to interactive elements and actions.
- Body and headline font: 'Inter', sans-serif, for clear readability in both the calculator and hidden chat interfaces.
- The default calculator UI will be a traditional button grid layout. The hidden chat interface will use a standard message input field with a send button and a clear message history button.
- Simple, universal icons for calculator functions (+, -, ×, ÷, =) and chat actions (send, clear). These should be minimalistic and consistent across both interfaces, colored in red.
- A subtle fade transition upon unlocking and locking the hidden chat interface to indicate mode switching, without disrupting the user experience.