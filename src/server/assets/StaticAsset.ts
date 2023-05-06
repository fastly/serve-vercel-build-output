import { ContentAsset } from "@fastly/compute-js-static-publish";
import AssetBase from "./AssetBase.js";

export default class StaticAsset extends AssetBase {
  contentType: string;
  contentAsset: ContentAsset;

  constructor(key: string, canonicalKey: string, asset: ContentAsset) {
    super(key, canonicalKey);
    this.contentType = asset.getMetadata().contentType;
    this.contentAsset = asset;
  }
}

