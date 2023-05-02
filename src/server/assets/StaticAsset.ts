import { ContentAsset } from "@fastly/compute-js-static-publish";
import AssetBase from "./AssetBase.js";

export default class StaticAsset extends AssetBase {
  contentType: string;
  contentAsset: ContentAsset;

  constructor(key: string, asset: ContentAsset) {
    super(key);
    this.contentType = asset.getMetadata().contentType;
    this.contentAsset = asset;
  }
}

