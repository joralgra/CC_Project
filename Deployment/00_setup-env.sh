#!/bin/bash

# This script is used to set up the environment
DC_FILE_PATH="../Subsystems/docker-compose.yaml"

#docker compose -f ../Subsystems/docker-compose.yaml build

# First we run the containers
docker compose -f $DC_FILE_PATH up -d --scale worker=0

# Build a worker image
#docker build -t worker ../Subsystems/Worker -t fa-worker