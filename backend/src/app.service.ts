import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type HealthStatus = {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptime: number;
  timestamp: string;
};

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Touches the database so a dead connection pool is reported as down
   * instead of quietly serving 200s. Returns 200 with `status: "degraded"`
   * rather than throwing, so a monitor can distinguish "process is up,
   * database is not" from "nothing is answering".
   */
  async health(): Promise<HealthStatus> {
    let database: HealthStatus['database'] = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
