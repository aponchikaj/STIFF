import { ValidationPipe } from '@nestjs/common';
import { UpdateGalleryItemDto } from './gallery.dto';

/**
 * The pipe, not the class.
 *
 * `whitelist: true` strips every property the pipe cannot see a decorator for,
 * which is exactly the protection we want and exactly the thing that silently
 * eats a field when its decorators are on a base class the pipe never looked
 * at. A hotspot arriving as two numbers and reaching the service as nothing is
 * invisible in a unit test of the service.
 */
async function through(body: unknown): Promise<UpdateGalleryItemDto> {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  return (await pipe.transform(body, {
    type: 'body',
    metatype: UpdateGalleryItemDto,
  })) as UpdateGalleryItemDto;
}

const PRODUCT_ID = '84e88a40-aa43-459c-854a-2cd423601a42';

describe('UpdateGalleryItemDto through the validation pipe', () => {
  it('keeps a hotspot on the way through', async () => {
    const dto = await through({
      productTags: [{ productId: PRODUCT_ID, hotspotX: 41.5, hotspotY: 62.25 }],
    });
    expect(dto.productTags).toEqual([
      { productId: PRODUCT_ID, hotspotX: 41.5, hotspotY: 62.25 },
    ]);
  });

  it('keeps the fields inherited from the shared links base', async () => {
    const dto = await through({
      tagIds: ['11111111-1111-4111-8111-111111111111'],
      credits: [{ role: 'photographer', name: 'Someone' }],
    });
    expect(dto.tagIds).toHaveLength(1);
    expect(dto.credits).toHaveLength(1);
  });

  it('accepts a piece with no pin', async () => {
    const dto = await through({ productTags: [{ productId: PRODUCT_ID }] });
    expect(dto.productTags).toEqual([{ productId: PRODUCT_ID }]);
  });

  it('rejects a coordinate outside the frame', async () => {
    await expect(
      through({
        productTags: [{ productId: PRODUCT_ID, hotspotX: 150, hotspotY: 10 }],
      }),
    ).rejects.toThrow();
  });

  it('strips anything it was not asked for', async () => {
    const dto = await through({ likeCount: 9999, altText: 'A description' });
    expect(dto.altText).toBe('A description');
    expect(dto as Record<string, unknown>).not.toHaveProperty('likeCount');
  });
});
