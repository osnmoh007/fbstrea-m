# Use the official Node.js image
FROM node:14

# Install FFmpeg and other required packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp using curl
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Telegram token
#ENV TELEGRAM_BOT_TOKEN=your_bot_token
#ENV ADMIN_USER_ID=your_admin_user_id
# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]
