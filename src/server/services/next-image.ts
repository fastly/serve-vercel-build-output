import { isURL } from "../utils/routing.js";
import { VercelBuildOutputServer } from "../server/index.js";
import StaticAsset from "../assets/StaticAsset.js";

export default class NextImageService {

  _vercelBuildOutputServer: VercelBuildOutputServer;
  constructor(
    vercelBuildOutputServer: VercelBuildOutputServer,
  ) {
    this._vercelBuildOutputServer = vercelBuildOutputServer;
  }

  async serve(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);

    // TODO: handle URLs from other domains
    const url = requestUrl.searchParams.get('url');
    if (isURL(url)) {
      return new Response('Image must be in the same domain', { status: 400 });
    }

    const asset = url != null ?
      this._vercelBuildOutputServer.assetsCollection
        .getAsset(url) :
      null;

    if (asset instanceof StaticAsset) {
      // TODO: optimization, applying w/h
      const storeEntry = await asset.contentAsset.getStoreEntry();
      return new Response(storeEntry.body, {
        status: 200,
        headers: {
          'Content-Type': asset.contentType,
        },
      });
    }

    // TODO: work with non-static assets too?

    return new Response('Asset not found', { status: 404 });
  }

}

