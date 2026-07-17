import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Railway injects PORT; local default matches FE API_DEFAULT_PORT (8387)
  const port = Number(process.env.PORT ?? 8387);
  await app.listen(port, '0.0.0.0');
  console.log(`auco-backend listening on :${port}`);
}

void bootstrap();
