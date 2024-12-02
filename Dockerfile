# Use the official Node.js image
FROM node:14

# Install FFmpeg and other required packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp using pip
RUN pip3 install yt-dlp

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Telegram token
ENV TELEGRAM_BOT_TOKEN=Your_Telegram_bot_token_here
ENV ADMIN_USER_ID=Your_Telegram_ID_here
# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]
