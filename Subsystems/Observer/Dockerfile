FROM node:16-alpine

# Change the work directory app
WORKDIR /app

# Move both package.json and package-lock.json
COPY ./package*.json ./

RUN npm install --no-optional && npm cache clean --force
ENV PATH /app/node_modules/.bin:$PATH

COPY . .

ENV NATS_URI=nats://localhost:4222

ENV PORT=9000

EXPOSE 9000

# # Run the server
CMD ["npm","run","main"]