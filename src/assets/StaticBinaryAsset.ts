import { BinaryAsset } from "@fastly/compute-js-static-publish";
import { StaticAsset } from "./StaticAsset";

export class StaticBinaryAsset extends StaticAsset {
  content: Uint8Array;

  constructor(key: string, asset: BinaryAsset) {
    super(key, asset);
    this.content = asset.content;
  }
}
