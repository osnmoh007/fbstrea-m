# Use Ubuntu-based Node.js image
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, ffmpeg, htop, and yt-dlp
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    htop \
    software-properties-common \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && add-apt-repository ppa:tomtomtom/yt-dlp \
    && apt-get update \
    && apt-get install -y yt-dlp \
    && rm -rf /var/lib/apt/lists/*

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
