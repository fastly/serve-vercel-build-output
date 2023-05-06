export default class AssetBase {
  key: string;
  canonicalKey: string;

  constructor(key: string, canonicalKey: string) {
    this.key = key;
    this.canonicalKey = canonicalKey;
  }
}
