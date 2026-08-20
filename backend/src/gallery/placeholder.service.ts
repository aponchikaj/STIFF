import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GalleryItem } from './gallery-item.entity';

/**
 * Blur-up placeholders for the archive grid.
 *
 * The grid already reserves the exact box for every photograph, so nothing
 * jumps. What it does not do is show anything while the photograph decodes,
 * and on a slow connection that is twenty grey rectangles.
 *
 * The placeholder is a ~24px JPEG, blurred, inlined as base64 in the payload
 * the page already fetches. Inline rather than a URL because the alternative
 * is twenty-four extra requests competing for bandwidth with the twenty-four
 * photographs they are standing in for, which is the problem it exists to
 * solve.
 */

/** Big enough to carry the composition, small enough to stay under a kilobyte. */
const LQIP_WIDTH = 24;

/**
 * A hard ceiling on what goes in the payload.
 *
 * A page of 24 placeholders is ~24KB of HTML at this size. If Cloudinary ever
 * hands back something larger than expected, dropping it costs a blur; keeping
 * it costs the page it was supposed to speed up.
 */
const MAX_BYTES = 2048;

/** Cloudinary is fast, but not on the critical path of publishing a shoot. */
const TIMEOUT_MS = 5000;

const CLOUDINARY_UPLOAD =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

@Injectable()
export class PlaceholderService {
  private readonly logger = new Logger(PlaceholderService.name);

  constructor(
    @InjectRepository(GalleryItem)
    private readonly galleryRepo: Repository<GalleryItem>,
  ) {}

  /**
   * The tiny render's URL, with the delivery rotation baked in.
   *
   * The rotation matters: a placeholder made from the stored pixels sits
   * sideways behind an upright photograph, and on a quarter turn its aspect
   * ratio is wrong too. `q_auto:low` on a 24px image is already unrecognisable
   * detail, so the blur only has to carry the colours.
   */
  lqipUrl(imageUrl: string, rotation: number): string | null {
    const match = CLOUDINARY_UPLOAD.exec(imageUrl);
    if (!match) return null;
    const [, base, rest] = match;
    const angle =
      rotation === 90 || rotation === 180 || rotation === 270
        ? `a_${rotation}/`
        : '';
    return `${base}${angle}f_jpg,q_30,c_limit,w_${LQIP_WIDTH},e_blur:400/${rest}`;
  }

  /**
   * Fetches one placeholder, or null.
   *
   * Never throws. A missing blur is a slightly duller loading state; a throw
   * here would fail the upload that a shoot is waiting on.
   */
  async generate(imageUrl: string, rotation = 0): Promise<string | null> {
    const url = this.lqipUrl(imageUrl, rotation);
    if (!url) return null;

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Placeholder fetch returned ${res.status}: ${url}`);
        return null;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
        this.logger.warn(
          `Placeholder was ${bytes.byteLength} bytes, outside 1..${MAX_BYTES}`,
        );
        return null;
      }
      return `data:image/jpeg;base64,${bytes.toString('base64')}`;
    } catch (error) {
      this.logger.warn(
        `Placeholder failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  /** Generates and stores one, quietly doing nothing when it cannot. */
  async refresh(item: GalleryItem): Promise<void> {
    const blurDataUrl = await this.generate(item.imageUrl, item.rotation);
    if (!blurDataUrl) return;
    await this.galleryRepo.update({ id: item.id }, { blurDataUrl });
  }

  /**
   * Fills in the archive that predates placeholders.
   *
   * Sequential rather than parallel: this runs over the whole archive at once
   * and there is no reason to open fifty sockets to Cloudinary to do it.
   */
  async backfill(limit = 100): Promise<{ processed: number; filled: number }> {
    const pending = await this.galleryRepo.find({
      where: { blurDataUrl: IsNull() },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      take: limit,
    });

    let filled = 0;
    for (const item of pending) {
      const blurDataUrl = await this.generate(item.imageUrl, item.rotation);
      if (!blurDataUrl) continue;
      await this.galleryRepo.update({ id: item.id }, { blurDataUrl });
      filled += 1;
    }

    this.logger.log(`Placeholders: ${filled} of ${pending.length} filled`);
    return { processed: pending.length, filled };
  }
}
