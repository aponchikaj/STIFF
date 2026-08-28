import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One animation on a sheet, with its own anchor correction.
 *
 * The offsets are per-animation rather than per-character because exported
 * sprite frames are not consistently anchored: on the same sheet, `singUp`
 * routinely needs a different nudge than `idle`. Getting this wrong is the
 * classic "why is the character sliding around" bug, which is why the admin
 * panel gets a live offset tuner rather than a number field.
 */
export interface CharacterAnimation {
  /** Frame-name prefix within the atlas. */
  prefix: string;
  fps: number;
  loop: boolean;
  offsetX: number;
  offsetY: number;
}

export type AnimationName =
  | 'idle'
  | 'singLeft'
  | 'singDown'
  | 'singUp'
  | 'singRight'
  | 'missLeft'
  | 'missDown'
  | 'missUp'
  | 'missRight'
  | 'win'
  | 'lose';

export type AnimationMap = Partial<Record<AnimationName, CharacterAnimation>>;

@Entity('game_characters')
@Unique('UQ_game_characters_slug', ['slug'])
export class GameCharacter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  atlasKey: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  atlasJsonKey: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  animations: AnimationMap;

  @Column({ type: 'varchar', length: 512, nullable: true })
  healthIconKey: string | null;

  @Column({ default: false })
  isPlayable: boolean;

  @Column({ default: true })
  isOpponent: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
