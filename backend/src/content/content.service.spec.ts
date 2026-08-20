import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ContentService } from './content.service';
import type { SiteContent } from './site-content.entity';

/** An in-memory stand-in for the site_content table. */
function repoWith(rows: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, SiteContent>(
    Object.entries(rows).map(([key, value]) => [
      key,
      { key, value, updatedAt: new Date(0) },
    ]),
  );
  return {
    store,
    repo: {
      findOne: ({ where }: { where: { key: string } }) =>
        Promise.resolve(store.get(where.key) ?? null),
      find: () => Promise.resolve([...store.values()]),
      create: (row: SiteContent) => row,
      save: (row: SiteContent) => {
        store.set(row.key, { ...row, updatedAt: new Date() });
        return Promise.resolve(row);
      },
    } as unknown as Repository<SiteContent>,
  };
}

function service(rows?: Record<string, Record<string, unknown>>) {
  return new ContentService(repoWith(rows).repo);
}

describe('ContentService', () => {
  describe('get', () => {
    it('falls back to the copy shipped in the registry, so a fresh database still renders a full site', async () => {
      const result = await service().get('about');
      expect(result.value.title).toBe('Nothing extra');
      expect(result.updatedAt).toBeNull();
    });

    it('layers saved values over the defaults rather than replacing them', async () => {
      const result = await service({
        about: { title: 'Worn to death' },
      }).get('about');
      expect(result.value.title).toBe('Worn to death');
      // Never saved, so the shipped paragraph is still there.
      expect(typeof result.value.body).toBe('string');
      expect(result.value.body).not.toBe('');
    });

    it('rejects a key the registry does not declare', async () => {
      await expect(service().get('pricing')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns every block from getAll, saved or not', async () => {
      const all = await service().getAll();
      expect(all.map((b) => b.key)).toContain('home-hero');
      expect(all.map((b) => b.key)).toContain('rules');
      expect(all.every((b) => Object.keys(b.value).length > 0)).toBe(true);
    });
  });

  describe('upsert validation', () => {
    it('trims text', async () => {
      const result = await service().upsert('about', { title: '  Spaced  ' });
      expect(result.value.title).toBe('Spaced');
    });

    it('drops fields the block does not declare instead of failing the save', async () => {
      // An older admin build must not be able to break on a newer registry.
      const result = await service().upsert('about', {
        title: 'Kept',
        somethingRemoved: 'dropped',
      });
      expect(result.value.title).toBe('Kept');
      expect(result.value.somethingRemoved).toBeUndefined();
    });

    it('refuses a payload with no recognised field at all', async () => {
      await expect(
        service().upsert('about', { nonsense: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('enforces the declared maximum length', async () => {
      await expect(
        service().upsert('about', { title: 'x'.repeat(200) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('will not take a string where the block declares a switch', async () => {
      await expect(
        service().upsert('features', { shopEnabled: 'yes' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('takes a real boolean for a switch', async () => {
      const result = await service().upsert('features', { shopEnabled: false });
      expect(result.value.shopEnabled).toBe(false);
    });

    it('keeps a partial save from blanking the rest of the block', async () => {
      const svc = service();
      await svc.upsert('contact-info', { email: 'a@b.com' });
      const after = await svc.upsert('contact-info', { location: 'Tbilisi' });
      expect(after.value.email).toBe('a@b.com');
      expect(after.value.location).toBe('Tbilisi');
    });
  });

  describe('list fields', () => {
    it('accepts a list of title/body pairs and trims both', async () => {
      const result = await service().upsert('rules', {
        items: [{ title: '  One  ', body: '  Body  ' }],
      });
      expect(result.value.items).toEqual([{ title: 'One', body: 'Body' }]);
    });

    it('rejects a list item with no title', async () => {
      await expect(
        service().upsert('rules', { items: [{ title: '   ', body: 'b' }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a list item missing a field entirely', async () => {
      await expect(
        service().upsert('rules', { items: [{ title: 'One' }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a string where a list belongs', async () => {
      await expect(
        service().upsert('rules', { items: 'one, two' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('caps the number of items so one save cannot balloon the page', async () => {
      const items = Array.from({ length: 40 }, (_, i) => ({
        title: `T${i}`,
        body: 'b',
      }));
      await expect(service().upsert('rules', { items })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts an empty list — a section can be emptied deliberately', async () => {
      const result = await service().upsert('rules', { practical: [] });
      expect(result.value.practical).toEqual([]);
    });
  });
});
