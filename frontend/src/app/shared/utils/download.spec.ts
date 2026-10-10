import { XLSX_MIME, downloadAttachment } from '@shared/utils/download';

describe('downloadAttachment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds a Blob, names the file and revokes the URL', async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b as Blob;
      return 'blob:x';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let name = '';
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        name = this.download;
      });

    downloadAttachment({ filename: 'a.xlsx', contentBase64: btoa('hello') });

    expect(click).toHaveBeenCalled();
    expect(name).toBe('a.xlsx');
    expect(blob?.type).toBe(XLSX_MIME);
    expect(await blob?.text()).toBe('hello');
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
