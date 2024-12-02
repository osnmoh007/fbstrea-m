# Use the official Node.js image
FROM node:14

# Install FFmpeg and other required packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    htop \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# Add and install yt-dlp from PPA
RUN add-apt-repository ppa:tomtomtom/yt-dlp && \
    apt-get update && \
    apt-get install -y yt-dlp && \
    rm -rf /var/lib/apt/lists/*

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
