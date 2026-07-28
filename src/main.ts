import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable strict payload validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips out properties without decorators
      forbidNonWhitelisted: true, // Throws an error if extra properties are sent
      transform: true, // Automatically transforms payloads to DTO instances
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`FleetPulse Ingestion Gateway running on port ${port}`);
}
void bootstrap();
