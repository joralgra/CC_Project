import { Application } from 'express';
import path from 'path';
import swaggerMiddleware from 'swagger-express-middleware';
import { requestLimit, swaggerApiSpec } from './env';
// import errorHandler from './middlewares/error.handler';

export default async function setupSwaggerAndRoutes(
  app: Application,
  routes: (application: Application) => void
) {
  const swaggerSpecPath = path.join(__dirname, 'api.yml');

  const promise = new Promise<boolean>((resolve) => {
    swaggerMiddleware(swaggerSpecPath, app, (_, middleWare) => {
      // Enable Express' case-sensitive and strict options
      // (so "/entities", "/Entities", and "/Entities/" are all different)
      app.enable('case sensitive routing');
      app.enable('strict routing');

      app.use(
        middleWare.metadata(),
        middleWare.files(app, { apiPath: swaggerApiSpec }),
        middleWare.parseRequest({
          // Configure the cookie parser to use secure cookies
          cookie: {
            secret: process.env.SESSION_SECRET,
          },
          // Don't allow JSON content over 100kb (default is 1mb)
          json: {
            limit: requestLimit,
          },
        }),
        middleWare.CORS(),
        middleWare.validateRequest()
      );

      routes(app);

      // app.use(errorHandler);

      return resolve(true);
    });
  });

  return promise;
}
