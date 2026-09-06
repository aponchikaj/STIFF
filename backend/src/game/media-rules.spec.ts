import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MIN_VIDEO_SECONDS,
  checkMedia,
  extensionFor,
  isSeasonDay,
  storedDuration,
  type MediaClaim,
} from './media-rules';

function video(overrides: Partial<MediaClaim> = {}): MediaClaim {
  return {
    kind: 'video',
    mimeType: 'video/mp4',
    byteSize: 5_000_000,
    durationSeconds: 30,
    ...overrides,
  };
}

function photo(overrides: Partial<MediaClaim> = {}): MediaClaim {
  return {
    kind: 'photo',
    mimeType: 'image/jpeg',
    byteSize: 400_000,
    ...overrides,
  };
}

describe('checkMedia', () => {
  describe('a clip', () => {
    it('accepts one inside the window', () => {
      expect(checkMedia(video({ durationSeconds: 30 }))).toEqual({ ok: true });
    });

    it('accepts exactly the shortest allowed', () => {
      expect(checkMedia(video({ durationSeconds: MIN_VIDEO_SECONDS }))).toEqual(
        { ok: true },
      );
    });

    it('accepts exactly the longest allowed', () => {
      expect(checkMedia(video({ durationSeconds: MAX_VIDEO_SECONDS }))).toEqual(
        { ok: true },
      );
    });

    it('refuses one a second too short', () => {
      const result = checkMedia(video({ durationSeconds: 4 }));
      expect(result).toEqual({
        ok: false,
        reason: 'Videos must be at least 5 seconds.',
      });
    });

    it('refuses one a second too long', () => {
      const result = checkMedia(video({ durationSeconds: 121 }));
      expect(result).toEqual({
        ok: false,
        reason: 'Videos must be 2 minutes or shorter.',
      });
    });

    /**
     * The browser reports fractional seconds. Refusing a 4.6-second clip for
     * being 0.4 short is a rule the player can neither see nor act on, so the
     * comparison rounds first.
     */
    it('rounds a fractional duration rather than refusing it', () => {
      expect(checkMedia(video({ durationSeconds: 4.6 })).ok).toBe(true);
      expect(checkMedia(video({ durationSeconds: 120.4 })).ok).toBe(true);
      expect(checkMedia(video({ durationSeconds: 4.2 })).ok).toBe(false);
      expect(checkMedia(video({ durationSeconds: 120.7 })).ok).toBe(false);
    });

    it('refuses a clip whose length it cannot read', () => {
      expect(checkMedia(video({ durationSeconds: null })).ok).toBe(false);
      expect(checkMedia(video({ durationSeconds: undefined })).ok).toBe(false);
      expect(checkMedia(video({ durationSeconds: NaN })).ok).toBe(false);
      expect(checkMedia(video({ durationSeconds: Infinity })).ok).toBe(false);
    });

    it('refuses a container we do not serve', () => {
      expect(checkMedia(video({ mimeType: 'video/x-msvideo' })).ok).toBe(false);
      expect(checkMedia(video({ mimeType: 'application/zip' })).ok).toBe(false);
    });

    it('accepts what a phone actually records', () => {
      for (const mimeType of ['video/mp4', 'video/webm', 'video/quicktime']) {
        expect(checkMedia(video({ mimeType })).ok).toBe(true);
      }
    });

    it('refuses one over the size cap', () => {
      expect(checkMedia(video({ byteSize: MAX_VIDEO_BYTES + 1 })).ok).toBe(
        false,
      );
      expect(checkMedia(video({ byteSize: MAX_VIDEO_BYTES })).ok).toBe(true);
    });

    it('refuses an empty file', () => {
      expect(checkMedia(video({ byteSize: 0 })).ok).toBe(false);
      expect(checkMedia(video({ byteSize: -1 })).ok).toBe(false);
    });
  });

  describe('a still', () => {
    it('accepts a normal photo', () => {
      expect(checkMedia(photo())).toEqual({ ok: true });
    });

    /** Duration is meaningless for a still and must not be required. */
    it('does not ask a photo how long it is', () => {
      expect(checkMedia(photo({ durationSeconds: undefined })).ok).toBe(true);
      expect(checkMedia(photo({ durationSeconds: null })).ok).toBe(true);
      expect(checkMedia(photo({ durationSeconds: 0 })).ok).toBe(true);
    });

    it('refuses a format we do not serve', () => {
      expect(checkMedia(photo({ mimeType: 'image/gif' })).ok).toBe(false);
      expect(checkMedia(photo({ mimeType: 'image/heic' })).ok).toBe(false);
    });

    it('refuses one over the size cap', () => {
      expect(checkMedia(photo({ byteSize: MAX_PHOTO_BYTES + 1 })).ok).toBe(
        false,
      );
    });
  });

  /**
   * A client that sends `video` with a photo's type, or a kind we have never
   * heard of, is refused rather than guessed at.
   */
  it('refuses a kind it does not know', () => {
    const claim = { ...photo(), kind: 'stream' } as unknown as MediaClaim;
    expect(checkMedia(claim)).toEqual({
      ok: false,
      reason: 'Choose a photo or a video.',
    });
  });

  it('refuses a photo type declared as a video', () => {
    expect(checkMedia(video({ mimeType: 'image/jpeg' })).ok).toBe(false);
  });
});

describe('storedDuration', () => {
  it('stores whole seconds for a clip', () => {
    expect(storedDuration(video({ durationSeconds: 30.4 }))).toBe(30);
    expect(storedDuration(video({ durationSeconds: 30.6 }))).toBe(31);
  });

  it('stores nothing for a still, whatever the client sent', () => {
    expect(storedDuration(photo())).toBeNull();
    expect(storedDuration(photo({ durationSeconds: 12 }))).toBeNull();
  });
});

describe('extensionFor', () => {
  it('maps the types we accept', () => {
    expect(extensionFor('video/quicktime')).toBe('mov');
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('video/webm')).toBe('webm');
  });

  /** Never let an unknown type decide the extension of a stored object. */
  it('falls back rather than trusting an unknown type', () => {
    expect(extensionFor('application/x-msdownload')).toBe('bin');
    expect(extensionFor('../../etc/passwd')).toBe('bin');
  });
});

describe('isSeasonDay', () => {
  it('knows the three rungs of the ladder', () => {
    expect(isSeasonDay(1)).toBe(true);
    expect(isSeasonDay(3)).toBe(true);
    expect(isSeasonDay(0)).toBe(false);
    expect(isSeasonDay(4)).toBe(false);
    expect(isSeasonDay('2')).toBe(false);
  });
});
