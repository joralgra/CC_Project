# Funciones

- Escalar arriba cuando haya trabajos encolados de más pub/sub de NATS
  - Mirar cuantos workers hay
  - Mirar cuantos trabajos hay encolados
  - Si hay mas trabajos que workers, escalar arriba
- Reencolar fallidos
  - Chckear todos los jobs en KV, si alguno esta en estado PENDING o RUNNING durante más de x tiempo reencolamos
  - Almacenar en el KV que se va a reencolar
  - Un publish los trabajos fallidos hasta un máximo de 3 veces (POISONED)
- ~~Escalar abajo cuando no haya trabajos encolados en la cola pub/sub de NATS ?¿?¿?¿?¿?¿?¿~~