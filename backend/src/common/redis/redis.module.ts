import {
  Global,
  Inject,
  Logger,
  Module,
  Optional,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createRedisClient, IoRedisAdapter } from './ioredis.adapter';
import { LeaderLockService } from './leader-lock.service';
import { REDIS, type RedisPort } from './redis.types';

/**
 * Redis, when there is one.
 *
 * Three things in this app are only correct on a single instance without it —
 * rate limiting, staff chat fan-out, and scheduled jobs — and all three fail
 * *quietly* when a second instance appears: limits multiply, chat messages go
 * missing, cron side effects duplicate. None of them throws, which is what
 * makes them dangerous.
 *
 * So the module is deliberately optional and deliberately loud. Unset, the app
 * runs exactly as it does today and says at boot that it is single-instance;
 * set, the three become safe to scale. What it must never do is fail to start
 * because Redis is missing — that would turn an optional dependency into a
 * required one for every developer on the project.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RedisPort | null => {
        const logger = new Logger('Redis');
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          logger.warn(
            'REDIS_URL not set — running single-instance: rate limits are ' +
              'per-process, staff chat does not fan out, and every cron runs ' +
              'on every process. Safe for one instance, not for two.',
          );
          return null;
        }
        const client = createRedisClient(url);
        client.on('error', (err: Error) =>
          logger.error(`Redis connection error: ${err.message}`),
        );
        logger.log('Redis connected — rate limits, chat and cron are shared');
        return new IoRedisAdapter(client);
      },
    },
    LeaderLockService,
  ],
  exports: [REDIS, LeaderLockService],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(
    @Optional() @Inject(REDIS) private readonly redis: RedisPort | null,
  ) {}

  /**
   * Closes the connection on shutdown.
   *
   * Render sends SIGTERM and waits; an open ioredis socket with retries
   * enabled will happily keep the process alive past that window and get
   * killed instead, which turns a clean deploy into a dropped request.
   */
  async onApplicationShutdown(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.disconnect();
    } catch (err) {
      this.logger.warn(
        `Redis did not close cleanly: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
