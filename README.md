# FBStream - Professional Streaming & Media Management Suite

FBStream is a comprehensive streaming and media management suite that combines professional streaming capabilities with YouTube downloading and Telegram bot integration. This all-in-one solution provides a secure, feature-rich platform for managing your streaming content and media files.

## Core Features

### 1. Video Streaming
- **Multi-Platform Support**
  - Facebook Live
  - YouTube Live
  - TikTok Live
  - Vimeo Live
  - Twitch
  - Custom RTMP endpoints
  - Local RTMP server

- **Stream Customization**
  - Dynamic text overlays with animations (bounce, slide-left, slide-right)
  - Logo watermark with position control
  - Region-based blur effects
  - Dynamic zoom controls
  - Custom MP3 audio integration
  - Multiple video source support (MP4 loop)

### 2. YouTube Downloader
- Multiple format support (MP4, MP3)
- Quality selection (1080p, 720p, 480p, 360p)
- Audio extraction (320kbps, 256kbps, 128kbps)
- Subtitle download support
- Cookie-based authentication for restricted content
- Integrated media library management

### 3. Telegram Bot Integration
- Stream status monitoring
- Remote stream control
- Message overlay management
- Real-time notifications
- Admin-only access control

### 4. Security Features
- Password-protected access
- Session management
- Secure authentication
- Dark/Light mode support
- Mobile-responsive design

## Technical Requirements

### System Requirements
- Node.js 18 or higher
- FFmpeg with all codecs
- Modern web browser
- Stable internet connection

### For Docker Deployment
- Docker
- Docker Compose (optional)

## Installation

### Standard Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fbstream.git
cd fbstream
```

2. Install dependencies:
```bash
npm install
```

3. Edit .env with your settings:
```env
STREAM_PASSWORD=your_password
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_USER_ID=your_telegram_user_id
```

4. Start the application:
```bash
node server.js
```

### 🐳 Docker Installation

1. Edit the `docker-compose.yml` file:
```yaml
services:
  fbstream:
    image: mohfreestyl/fbstream:latest
    volumes:
     - ./videos:/usr/src/app/videos     # 📁 Local video storage
     - ./media:/usr/src/app/media       # 🎵 Local media storage (for sound.mp3)
    environment:
      STREAM_PASSWORD: "your_password"         # 🔑 Your access password
      TELEGRAM_BOT_TOKEN: "your_bot_token"     # 🤖 Your Telegram bot token
      ADMIN_USER_ID: "your_telegram_user_id"   # 👤 Your Telegram user ID
    ports:
      - "3000:3000"    # 🌐 Web interface port
```

2. Create required directories:
```bash
# 📂 Create directories for persistent storage
mkdir -p videos media
```

3. Add your sound file (optional):
```bash
# 🎵 Copy your background music file
cp sound.mp3 media/
```

4. Start the container:
```bash
# 🚀 Launch in detached mode
docker-compose up -d
```

5. View logs (optional):
```bash
# 📊 Monitor container logs
docker-compose logs -f
```

The application will be available at `http://localhost:3000` 🌐

> 💡 **Tips:**
> - Keep your environment variables secure
> - Use strong passwords
> - Backup your media folders regularly
> - Check logs for troubleshooting

### 🛠️ Common Docker Commands

```bash
# 🔄 Restart the container
docker-compose restart

# ⏹️ Stop the container
docker-compose down

# 📝 View container status
docker-compose ps

# 🔍 Check container resources
docker stats fbstream
```

## Usage Guide

### 1. Video Streaming

#### Stream Setup
1. Access the streaming interface
2. Configure RTMP destination
3. Select input source (M3U8/MP4)
4. Configure visual enhancements
5. Start streaming

#### Text Overlay
- Customize font size
- Set text color
- Enable/disable background
- Choose animation style

#### Visual Effects
- Position logo watermark
- Set blur regions
- Adjust zoom levels
- Configure MP3 background audio

### 2. YouTube Downloader

#### Download Process
1. Enter YouTube URL
2. Select format and quality
3. Enable/disable subtitles
4. Configure cookies (if needed)
5. Start download

#### Media Library
- View downloaded files
- Play media
- Rename files
- Delete content

### 3. Telegram Bot Control

#### Bot Commands
- Get streaming status
- Stop stream
- Send overlay message
- Clear overlay message

#### Setup
1. Create bot via BotFather
2. Set bot token in environment
3. Configure admin user ID
4. Start bot service

## System Monitoring

- Real-time CPU usage
- Memory utilization
- FFmpeg process monitoring
- Stream duration tracking
- Comprehensive logging system

## Troubleshooting

### Common Issues
- **Stream Not Starting**: Verify RTMP credentials and server status
- **Download Fails**: Check YouTube URL and cookie configuration
- **Bot Unresponsive**: Verify token and admin ID settings
- **Performance Issues**: Monitor system resources and logs

### Logs
- Server logs: `logs/server.log`
- Telegram bot logs: `telegram_bot.log`
- Stream messages: `messages.txt`

## Security Considerations

- Use strong passwords
- Keep environment variables secure
- Regularly update dependencies
- Monitor access logs
- Use HTTPS in production

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For support:
1. Check the troubleshooting guide
2. Review server logs
3. Open an issue on GitHub
4. Contact development team

---

© 2024 FBStream. All rights reserved.  
Visit [mohamedmaamir.com](https://mohamedmaamir.com)
