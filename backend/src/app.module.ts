import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./common/app.service";
import { DatabaseService } from "./common/database.service";
import { IdempotencyInterceptor } from "./common/idempotency.interceptor";
import { MetricsService } from "./common/metrics.service";

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseService,
    MetricsService,
    IdempotencyInterceptor
  ]
})
export class AppModule {}
