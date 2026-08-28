import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { GameCharacter } from './character.entity';
import { Song } from './song.entity';
import { Stage } from './stage.entity';

/** e.g. `{ "clearedLevelId": "..." }` or `{ "minRank": "A", "chartId": "..." }`. */
export type UnlockRule = Record<string, string | number | boolean>;

/**
 * An ordered grouping of songs — a "week" in the story mode.
 *
 * The character and stage relations are RESTRICT, not SET NULL: a level with
 * no opponent is not degraded, it is unplayable, and a failed delete is how
 * the admin panel discovers the character is still in use.
 */
@Entity('game_levels')
@Unique('UQ_game_levels_slug', ['slug'])
@Index('IDX_game_levels_position', ['position'])
export class Level {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'jsonb', nullable: true })
  unlockRule: UnlockRule | null;

  @ManyToOne(() => GameCharacter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'opponentCharacterId' })
  opponent: GameCharacter | null;

  @Column({ type: 'uuid', nullable: true })
  opponentCharacterId: string | null;

  @ManyToOne(() => GameCharacter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'playerCharacterId' })
  player: GameCharacter | null;

  @Column({ type: 'uuid', nullable: true })
  playerCharacterId: string | null;

  @ManyToOne(() => Stage, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'stageId' })
  stage: Stage | null;

  @Column({ type: 'uuid', nullable: true })
  stageId: string | null;

  @Column({ default: false })
  isPublished: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('game_level_songs')
@Unique('UQ_game_level_songs_song', ['levelId', 'songId'])
@Unique('UQ_game_level_songs_position', ['levelId', 'position'])
export class LevelSong {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Level, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'levelId' })
  level: Level;

  @Column('uuid')
  levelId: string;

  @ManyToOne(() => Song, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'songId' })
  song: Song;

  @Column('uuid')
  songId: string;

  @Column({ type: 'int', default: 0 })
  position: number;
}
