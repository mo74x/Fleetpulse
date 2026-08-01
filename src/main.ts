import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('FleetPulse Logistics API')
    .setDescription(
      'The core routing, dispatch, and ledger API for the FleetPulse logistics engine.',
    )
    .setVersion('1.0')
    .addTag('orders', 'Order ingestion and management')
    .addTag('search', 'Elasticsearch waybill queries')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Connect Microservice (RabbitMQ Consumer)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URI || 'amqp://localhost:5672'],
      queue: 'orders_events_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false,
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`FleetPulse HTTP Gateway running on port ${port}`);
  console.log(`FleetPulse Microservice Consumer is listening`);
}
void bootstrap();
