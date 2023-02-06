import { BinaryAsset } from "@fastly/compute-js-static-publish";
import StaticAsset from "./StaticAsset";

export default class StaticBinaryAsset extends StaticAsset {
  content: Uint8Array;

  constructor(key: string, asset: BinaryAsset) {
    super(key, asset);
    this.content = asset.content;
  }
}
