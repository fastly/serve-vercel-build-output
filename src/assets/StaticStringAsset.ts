import { StringAsset } from "@fastly/compute-js-static-publish";
import StaticAsset from "./StaticAsset";

export default class StaticStringAsset extends StaticAsset {
  content: string;

  constructor(key: string, asset: StringAsset) {
    super(key, asset);
    this.content = asset.content;
  }
}
