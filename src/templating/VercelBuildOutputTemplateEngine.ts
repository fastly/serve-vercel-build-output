import TemplateEngine from "./TemplateEngine";

// All known template names
// TODO(?): enumerate from file system
const TEMPLATE_NAMES = [
  'redirect',
];

interface RedirectInputs {
  statusCode: number;
  location: string;
}


export default class VercelBuildOutputTemplateEngine extends TemplateEngine {

  constructor(
    modulePath: string = './node_modules/@fastly/serve-vercel-build-output',
  ) {
    super(modulePath, TEMPLATE_NAMES);
  }

  redirectTemplate(obj: RedirectInputs) {
    return this.execTemplate('redirect', obj);
  }

}
