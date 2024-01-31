# About the project

Project for an UPV Master on High performance computing assigment.
Evaluates the expression of faces using the faceapi ssdMobilenetv1. Communication made with NATS Queue Stream + NATS KV and
NATS Object Store.

![img.png](img.png)

# Project Structure

- Orchestration (Files for system / services deployment)
- Subsystems (What the system is composed with)
    - Worker
    - Frontend
- Examples (Pooc examples)

# Install / Deploy

TODO - Using docker compose? And then migrate to Kubernetes / Kumori?

# Run (Vía docker compose)

```bash
docker compose up --build -d -f subsystems/docker-compose.yaml
```
Accesible

# Run (Vía MiniKube)

```bash

```

---

# Relevant messagaing data

## Names

### NATS Pub/Sub queue name

*states* - For job related stuff

*logs* - Internal for job system logging and observer functionality.

### NATS Object Store name

*data*

### Job states for KV states

Frontend:

- ENQUEUED

Backend:

- PENDING
- RUNNING
- FINISHED
- ERROR

---

## Formatting

## NATS Pub/Sub queue message format

```json
{}
```

## NATS KV format

Key {user}.{job-id}

p.e

```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

Value
p.e

```json
{}
```

## NATS Object Store blob naming

For input files {job-id}-input
p.e

```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-input
```

For output files {job-id}-output
p.e

```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-output
```
