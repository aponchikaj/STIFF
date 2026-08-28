import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** Ordered back-to-front: draw order is the whole point of a stage. */
export interface StageLayer {
  assetKey: string;
  parallaxX: number;
  parallaxY: number;
  /** How much this layer scales on a beat pulse. 1 means it does not. */
  beatScale: number;
}

@Entity('game_stages')
@Unique('UQ_game_stages_slug', ['slug'])
export class Stage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  layers: StageLayer[];

  @Column({ type: 'double precision', default: 1 })
  baseZoom: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
