# FBStream - Advanced Streaming Configuration Tool

FBStream is a powerful streaming configuration tool that allows you to manage and customize your streaming content across multiple platforms. With its intuitive interface and advanced features, it provides professional-grade streaming capabilities with real-time controls and monitoring.

## Features

- **Multi-Platform Streaming**
  - Facebook Live
  - YouTube Live
  - TikTok Live
  - Vimeo Live
  - Custom RTMP endpoints

- **Advanced Content Management**
  - M3U file support
  - MP4 video loop functionality
  - Custom video upload capabilities
  - Playlist management

- **Visual Enhancements**
  - Dynamic zoom controls
  - Region-based blur effects
  - Logo overlay with position customization
  - Text overlay with animations
  - Custom audio integration (MP3)

- **Responsive Design**
  - Mobile-friendly interface
  - Touch-optimized controls
  - Adaptive layouts
  - Cross-device compatibility

- **Real-Time Monitoring**
  - CPU usage tracking
  - Memory utilization
  - Stream health indicators
  - Comprehensive logging system

## Prerequisites

- Node.js (v14 or higher)
- FFmpeg with all codecs
- Modern web browser
- Stable internet connection

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fbstream.git
cd fbstream
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Start the application:
```bash
npm start
```

5. Access the interface:
```
http://localhost:3000
```

## Configuration

### Stream Settings
- RTMP URL configuration
- Stream key management
- M3U8/HLS stream support
- Video quality settings

### Content Management
- Upload and manage MP4 files
- M3U playlist configuration
- Custom video loop settings
- Audio track integration

### Visual Effects
- Zoom level: 0-200%
- Blur region selection
- Logo positioning
- Text overlay customization
- Animation parameters

### Mobile Settings
- Responsive breakpoints
- Touch-friendly controls
- Adaptive input fields
- Optimized viewport settings

## Usage

1. **Initial Setup**
   - Log in to the application
   - Configure stream destination
   - Set up content sources

2. **Content Configuration**
   - Upload videos or configure streams
   - Set up visual effects
   - Configure overlays

3. **Stream Management**
   - Start/stop streaming
   - Monitor performance
   - Adjust settings in real-time

4. **Mobile Access**
   - Access via mobile browser
   - Use touch-optimized controls
   - Monitor stream on-the-go

## Technical Details

### FFmpeg Configuration
```bash
ffmpeg -i [input] -vf "scale=1920:1080" -c:v libx264 -preset veryfast -b:v 4500k [output]
```

### Mobile Viewport Settings
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

## Troubleshooting

- **Stream Issues**
  - Verify RTMP URL and stream key
  - Check network connectivity
  - Monitor system resources

- **Mobile Display Problems**
  - Clear browser cache
  - Check device compatibility
  - Verify internet connection

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.

---

 2024 FBStream. All rights reserved.
