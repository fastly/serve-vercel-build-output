interface ImportMeta {
  url: string;
}

interface Request {
  clone(): Request;
}

type ContentTypeDef = {
  test: RegExp | ((path: string) => boolean),
  type: string,
  binary?: boolean,
};

type ContentTypeTestResult = {
  type: string,
  binary: boolean,
};

declare module "@fastly/compute-js-static-publish/resources/default-content-types" {

  function mergeContentTypes(entries?: ContentTypeDef[]): ContentTypeDef[];
  function testFileContentType(entries: ContentTypeDef[], path: string): ContentTypeTestResult | null;

}
