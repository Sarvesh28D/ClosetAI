# ClosetAI - Your AI Fashion Assistant

![ClosetAI Interface](screenshot.png)

ClosetAI is an innovative AI-powered fashion assistant that provides personalized style advice through interactive video chat. Using advanced computer vision and natural language processing, ClosetAI can see and analyze your outfits in real-time to offer tailored fashion recommendations.

## ✨ Features

- **Real-time Video Chat**: Interactive video communication with your AI fashion assistant
- **Live Style Analysis**: AI can see and analyze your current outfit in real-time
- **Personalized Recommendations**: Get customized fashion advice based on your style preferences
- **Occasion-based Styling**: Receive outfit suggestions for specific events or occasions
- **Interactive Chat Interface**: Seamless conversation flow with your AI stylist
- **Voice & Video Support**: Multi-modal interaction for a natural experience

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Webcam and microphone for video chat functionality

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/gemini-videochat.git
cd gemini-nextjs
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

Add your API keys to `.env.local`:
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
# Add other required environment variables
```

4. Run the development server
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🎯 How It Works

1. **Start a Session**: Click to begin your style consultation
2. **Enable Camera**: Allow ClosetAI to see your current outfit
3. **Chat Naturally**: Ask questions about your style, upcoming events, or fashion advice
4. **Get Recommendations**: Receive personalized suggestions based on what you're wearing
5. **Real-time Analysis**: ClosetAI continuously analyzes your appearance for better advice

## 💡 Usage Examples

- "What's the occasion you're dressing for?"
- "Is it a daytime or nighttime event?"
- "How does this outfit look for a business meeting?"
- "Can you suggest accessories for this look?"
- "What colors would work better with this outfit?"

## 🛠️ Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **AI Integration**: Google Gemini API
- **Styling**: Tailwind CSS
- **Video/Audio**: WebRTC, MediaDevices API
- **Real-time Communication**: WebSockets

## 📁 Project Structure

```
gemini-nextjs/
├── components/          # React components
├── pages/              # Next.js pages
├── styles/             # CSS and styling files
├── utils/              # Utility functions
├── public/             # Static assets
├── types/              # TypeScript type definitions
└── README.md           # Project documentation
```

## 🔧 Configuration

### Camera and Microphone Setup

Ensure your browser has permission to access:
- Camera (for outfit analysis)
- Microphone (for voice interaction)

### API Configuration

Configure your Gemini API settings in the environment variables for optimal performance.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request



## 🙋‍♀️ Support

If you have any questions or need support, feel free to:
- Open an issue in this repository
- Contact the development team
- Check out our documentation

---

**Ready to look amazing?** Start your style journey with ClosetAI today! 👗✨
