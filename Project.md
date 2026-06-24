# ClosetAI: Your AI Fashion Assistant

## Project Description

ClosetAI is a virtual fashion consultant that provides real-time styling advice through video chat with Google's Gemini 2.0 AI. This interactive application functions as a fashion-savvy best friend that helps users make confident clothing choices by analyzing their outfits through their camera and providing personalized recommendations. The AI can see users' clothing combinations, hear their styling questions, and respond with both text and voice feedback about colors, fit, accessories, and occasion-appropriateness.

The application leverages Gemini 2.0's multimodal capabilities to understand visual fashion elements (patterns, colors, styles) while maintaining a natural conversation flow. ClosetAI offers honest, constructive feedback on outfit choices and makes specific suggestions based on the event type, time of day, and user's style preferences - just like having a personal stylist at home.

## Technologies Used

- **Frontend Framework**: Next.js 15.1.7 with React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **AI Integration**: Google Gemini 2.0 Flash API
- **Real-time Communication**: WebSocket API
- **Audio Processing**: Web Audio API, AudioWorklet
- **Media Handling**: 
  - Video capture via getUserMedia API
  - Audio processing with custom AudioWorklet
  - PCM/WAV audio conversion
- **UI Components**: Radix UI primitives for accessible components
- **TypeScript**: For type-safe code
- **Base64 Encoding/Decoding**: For media data transmission

## Project Aim and Outcome

### Aim
The primary goal was to create a virtual fashion consultant that can analyze users' outfits through a camera and provide real-time styling advice. Specifically, ClosetAI aimed to:

1. Implement a fashion-savvy AI assistant that can see and analyze clothing combinations
2. Process visual fashion elements and user speech in real-time
3. Enable natural conversation about styling choices with transcription
4. Create an intuitive interface that feels like chatting with a personal stylist
5. Demonstrate how AI can provide practical fashion advice in a conversational manner

### Outcome
The project successfully delivered:

- A functional web application that processes both visual and audio input in real-time
- Live audio feedback from the AI with synchronized responses
- A chat interface that displays transcribed AI responses
- A system that can analyze visual data (outfits) and provide contextual feedback
- A demonstration of how WebSockets can be used with AI API services for real-time communication
- An example of implementing AudioWorklet for efficient audio processing

## Skills Gained

Through building this fashion consultation application, the following skills and knowledge areas were developed:

1. **Fashion-aware AI Integration**: Working with cutting-edge multimodal AI models capable of understanding clothing styles and visual aesthetics
2. **Audio Response Processing**: Advanced audio handling for natural stylist-like vocal responses with WebAudio API and custom AudioWorklet
3. **Real-time Fashion Consultation**: Implementing bidirectional communication protocols for immediate style feedback
4. **Visual Fashion Analysis**: Working with camera feeds to capture and analyze clothing combinations in real-time
5. **React/Next.js Development**: Building a complex fashion application with modern React practices
6. **Stylist UI/UX Design**: Creating an intuitive interface that mimics a conversation with a personal stylist
7. **TypeScript Development**: Writing type-safe code for a robust fashion consultation system
8. **Media Processing**: Working with various data formats (PCM, WAV, base64) for processing and analyzing fashion visuals
9. **AI Style API Integration**: Working with Google's Generative AI APIs for fashion analysis
10. **User Experience Optimization**: Implementing robust error handling to ensure a seamless styling consultation experience

## Time to Complete

The development of this project took approximately:

- Planning and architecture: 1 week
- Initial setup and configuration: 2 days
- Core functionality development: 2 weeks
- UI implementation: 3 days
- Testing and refinement: 1 week
- Documentation: 2 days

**Total time**: Approximately 4 weeks (part-time development)

## Future Enhancements

- Style history tracking to remember user preferences
- Outfit cataloging and categorization features
- Seasonal fashion trend updates through AI model fine-tuning
- Virtual try-on capabilities for suggested items
- Shopping recommendations based on analyzed style gaps
- Mobile responsive design for styling advice on-the-go
- Multi-language support for international fashion advice
- Social sharing features for outfit validation from friends
