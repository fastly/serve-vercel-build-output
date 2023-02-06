import TemplateEngine from "./TemplateEngine";

// All known template names
// TODO(?): enumerate from file system
const TEMPLATE_NAMES = [
  'redirect',
];

export default class VercelBuildOutputTemplateEngine extends TemplateEngine {

  constructor(
    modulePath: string = './node_modules/@fastly/serve-vercel-build-output',
  ) {
    super(modulePath, TEMPLATE_NAMES);
  }

  redirectTemplate(obj: any) {
    return this.execTemplate('redirect', obj);
  }

}
