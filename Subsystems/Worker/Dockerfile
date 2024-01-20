FROM node:20.3.1-slim

# Change the work directory app
#WORKDIR /app

# Move both package.json and package-lock.json
COPY . .

RUN npm install -g npm@9.6.7
RUN ls
RUN npm install
#ENV PATH /app/node_modules/.bin:$PATH

#COPY . .

# Compile files in the dist folder
RUN #npm run build

#EXPOSE 3000

# # Run the server
CMD ["node","worker.js"]