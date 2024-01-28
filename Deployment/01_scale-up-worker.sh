#!/bin/bash

DC_FILE_PATH="../Subsystems/docker-compose.yaml"

# 1. Number of nodes to add
if [[ "$#" -eq 0 ]]; then
    echo "Please provide at least one argument."
    exit 1
fi

if [[ "$1" =~ ^[0-9]+$ ]]; then
    TARGET_NODES_INCREMENT="$1"

    # Now you can use $TARGET_NODES_INCREMENT in your script
else
    echo "Argument 1 is not an integer."
fi

# Docker Compose service name for worker nodes
WORKER_SERVICE_NAME="worker"

# Get the current number of running worker nodes
RUNNING_NODES=$(docker compose -f $DC_FILE_PATH ps -q $WORKER_SERVICE_NAME | wc -l)

echo "OriginalWorkerNodes: $RUNNING_NODES"

# INCREMENT the number of nodes
NEW_NODE_COUNT=$((RUNNING_NODES + $TARGET_NODES_INCREMENT))

# Scale the worker service to add one more node
docker compose -f $DC_FILE_PATH up  -d --scale $WORKER_SERVICE_NAME=$NEW_NODE_COUNT

# Get the current number of running worker nodes
RUNNING_NODES=$(docker compose -f $DC_FILE_PATH ps -q $WORKER_SERVICE_NAME | wc -l)

# Display the result
echo "UpdatedWorkerNodes $RUNNING_NODES"
