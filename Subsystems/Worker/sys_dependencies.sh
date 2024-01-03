# For Brain.js to work on WSL or Ubuntu/Debian systems: src(https://brain.js.org/#/getting-started)
#sudo apt-get install -y build-essential libxi-dev libglu1-mesa-dev libglew-dev pkg-config

# Install Node Version
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
nvm install v18.17.0


sudo apt install libpango1.0-dev libcairo-dev libpixman-1-dev libjpeg-dev