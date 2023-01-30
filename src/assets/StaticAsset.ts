import { Asset } from "@fastly/compute-js-static-publish";
import { AssetBase } from "./AssetBase";

export class StaticAsset extends AssetBase {
  type: "string" | "binary";

  contentType: string;

  constructor(key: string, asset: Asset) {
    super(key);
    this.type = asset.type;
    this.contentType = asset.contentType;
  }
}

