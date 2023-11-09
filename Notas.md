## Trabajo teórico

Presentar trabajo eligiendo uno de los tres temas propuestos (Al final solo hay que explicar como se a compuesto el sistema?)
## Laboratorio

### Desarrollar software SaaS

Desplegable en una máquina con docker-compose

Laboratorio usando **Visual Studio Code + Linux + Git**

Entrega en .tar.gz de repositorio de Git... no le gusta Gitlab

Entre 4 personas

El SaaS desarrollado tiene que tener una imagen registrada

Se utilizara un servicio NATS como Message Queue (en lugar de Kafka)

**DESCRIPCIÓN:**

- Hay que hacer un FaaS y guardar sus trabajos en una cola NATS.
- Hay que hacer un Fronend REST para efectuar las peticiones de los clientes.
- Las peticiones son REST con carga JSON
- El Worker cogera las work orders efectúa el trabajo y pone sus resultados en otra cola para recogerlos.
- Usar oauth2-proxy para la autenticación con openid-connect (usando un proveedor externo?)
- Hace falta un injector... ?¿¿??¿ No hace falta
- FaaS Observer: Mira la carga del sistema... para decidir si escalar o detectar si esta infracargado para reducirlos.
- KPaaS a poder ser. Hay que confeccionar manifiestos sobre KPaaS y un paper con discusión sobre los pros y contras de desplegar en AWS>EKS y Azure>AKS y KPaaS ([[Kumori]])
- Lenguajes permitidos:
	- nodejs preferiblemente typescript
	- RUST
	- GO

Hay librerias para atacar un servidor NATS en npm nodejs (hay que usar async/await constantemente) - ... NATS necesita un duplex en la infrastructura


-> Deadline 31 Enero
